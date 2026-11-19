// Who may move a task where. Pure checks: each takes the task, who is asking and what the board knows
// about them, and returns the refusal text, or null when the change is allowed. board.js gathers that
// context, throws the refusal, and does the writes and events. Board lookups that cost a query are
// passed as functions, so they only run when the rule gets that far.

// 'proposed': suggested by a non-planner agent, waiting for the planner (or a human) to approve it.
export const STATUSES = ['proposed', 'open', 'claimed', 'in_progress', 'blocked', 'review', 'done'];

// "1 task", "2 tasks": for guidance and refusal texts.
export const countOf = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
// An agent's task limit as the web board shows it, with the planner's extra slots said separately.
export const slotText = (cap) => cap.extra ? `${cap.base} at once (+${cap.extra} extra as planner while others are busy)` : `${cap.slots} at once`;

// claim_task: an agent takes a task (open → claimed).
//   task, id; reservedElsewhere(): reserved for another agent who is around; waits: its unfinished
//   dependencies; capacity(): the agent's slots; idle(): teammates with nothing to do; free(): unreserved
//   claimable tasks.
export function claimRefusal({ id, task, reservedElsewhere, waits, capacity, idle, free }) {
  if (task.status === 'proposed') return `task #${id} is only proposed: the planner hasn't approved it yet. Pick another task.`;
  if (reservedElsewhere()) return `task #${id} is reserved for ${task.reserved_for}. Pick another task.`;
  // Unfinished dependencies are named in every refusal: they're usually the reason that matters.
  const alsoWaits = waits.length ? ` Also, #${id} waits on ${waits.map((b) => `#${b.id} (${b.status})`).join(', ')}.` : '';
  if (task.status === 'open') {
    const cap = capacity();
    if (cap.active >= cap.slots) {
      return `You already hold ${countOf(cap.active, 'active task')} and may hold ${slotText(cap)} (${cap.plan || 'no plan given'}${cap.override ? ', set on the web board' : ''}). Finish or release one first.${alsoWaits}`;
    }
    // Extra planner slots (nobody else free) are for small and medium work only.
    if (cap.extra && cap.active >= cap.base && task.size === 'L') {
      return `You're using the planner's extra slots (nobody else is free); those are for S/M tasks only. #${id} is size L: leave it for an agent with room.${alsoWaits}`;
    }
    const idleNames = idle();
    const freeCount = free();
    if (cap.active >= 1 && idleNames.length && freeCount <= idleNames.length) {
      return `Leave this for an idle teammate: ${idleNames.join(', ')} have no task and there are only ${countOf(freeCount, 'unreserved task')} to go around. Keep working on yours and wait_for_events.${alsoWaits}`;
    }
  }
  if (waits.length) return `task #${id} depends on unfinished task(s): ${waits.map((b) => `#${b.id} (${b.status})`).join(', ')}`;
  return null;
}

// update_task: a status move or an edit, by an agent or (human) on the web board / REST.
//   id, task, the requested fields (status, branch, assignee, reserved_for, pr_url, force), human;
//   owner: the asker holds the task (or is on its team); canMerge: the asker merges it (the integrator,
//   or the agent that took its review); isPlanner; integrator: settings.integrator; anyone: the integrator
//   is "whoever is free". Lookups: capacity() of the asker, waitingOn() its unfinished dependency ids,
//   othersOnline() another agent is online, ownerAway() its owner crashed (stale and offline) or is out
//   of usage.
export function updateRefusal(c) {
  const { id, task, status, human } = c;
  if (status !== undefined && !STATUSES.includes(status)) return `status must be one of ${STATUSES.join(', ')}`;
  const changingStatus = status !== undefined && status !== task.status;
  return (human ? humanMoveRefusal(c, changingStatus) : agentChangeRefusal(c, changingStatus))
    // A pull request link: set by the owner, whoever merges it, or a human.
    || (c.pr_url !== undefined && !human && !c.owner && !c.canMerge ? `Only ${task.assignee || 'the task owner'}, whoever merges it, or a human can set #${id}'s PR link.` : null);
}

// A human moving a card to claimed / in progress: it needs an owner, and its dependencies done
// (otherwise nobody holds it and no agent can claim it). API callers can send force: true to move it
// anyway; the messages are for people on the web board, so they don't mention it.
function humanMoveRefusal({ id, task, status, assignee, force, waitingOn }, changingStatus) {
  if (force || !changingStatus || !['claimed', 'in_progress'].includes(status)) return null;
  if (!(assignee !== undefined ? assignee : task.assignee)) return `Pick who #${id} is for first.`;
  const waiting = ['claimed', 'in_progress'].includes(task.status) ? [] : waitingOn();
  if (!waiting.length) return null;
  const list = waiting.map((d) => '#' + d);
  const names = list.length === 1 ? list[0] : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
  return `#${id} waits on ${names}, which ${list.length === 1 ? "isn't" : "aren't"} done yet.`;
}

function agentChangeRefusal(c, changingStatus) {
  const { id, task, status, branch, owner, canMerge, integrator, anyone } = c;
  if (c.assignee !== undefined) return 'Only humans can assign tasks (on the web board). The planner can reserve one for an agent with reserved_for.';
  if (c.reserved_for !== undefined && !c.isPlanner) return 'Only the planner and humans can reserve tasks for an agent.';
  if (status === 'proposed') return 'status "proposed" is set by the board when a non-planner creates a task.';
  if (task.status === 'proposed' && changingStatus) return `task #${id} is a proposal: the planner approves or rejects it with decide_proposal.`;
  // The merger may move a task out of review: done, back to in_progress for fixes, or blocked (can't test it).
  const merger = task.status === 'review' && ['done', 'in_progress', 'blocked'].includes(status) && canMerge;
  // Blocked and done tasks don't hold a slot, so unblocking or reopening one has to fit within the slots again.
  if (owner && ['blocked', 'done'].includes(task.status) && ['claimed', 'in_progress'].includes(status)) {
    const cap = c.capacity();
    if (cap.active >= cap.slots) return `You hold ${cap.active} of ${cap.slots} task(s) at once: finish or release one before ${task.status === 'done' ? 'reopening' : 'unblocking'} #${id}.`;
  }
  // Done means merged: only whoever merges moves a task to done, and only from review. Without anyone to
  // review it (no integrator yet, or no other agent online) the owner may mark its own work done.
  // (Someone else's task: the ownership check below refuses it.)
  if (owner && changingStatus && status === 'done' && !(task.status === 'review' && canMerge) && integrator && c.othersOnline()) {
    if (task.status !== 'review') {
      return canMerge
        ? `Move #${id} to review first (update_task status "review"), then merge it and mark it done.`
        : `Move #${id} to review first (update_task status "review", with pr_url if you opened a PR): ${anyone ? 'another agent takes it with claim_review' : `${integrator} reviews it`} and marks it done once it's merged.`;
    }
    return anyone
      ? `#${id} is waiting for review: another agent takes it with claim_review and merges it. Carry on with other work.`
      : `#${id} is waiting for ${integrator} to review and merge it. Carry on with other work.`;
  }
  if (!task.assignee && (changingStatus || branch !== undefined)) return `task #${id} isn't claimed by anyone. Claim it first (claim_task).`;
  // A crashed agent's task, or one whose owner hit its usage limit: anyone may put it back to open.
  const takeover = () => status === 'open' && c.ownerAway();
  if (task.assignee && !owner && (changingStatus || branch !== undefined) && !merger && !takeover()) {
    return task.stale
      ? `task #${id} belongs to ${task.assignee}. It's stale but they're still online: post to @${task.assignee} first.`
      : task.status === 'review' && anyone
        ? `task #${id} is in review. Take the review first with claim_review(${id}), then you can merge it or send it back.`
        : `task #${id} is assigned to ${task.assignee}; post a message to them instead of changing it.`;
  }
  return null;
}
