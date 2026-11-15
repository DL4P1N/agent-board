import{p as Dh,P as Dl,R as bt,a as Rf,D as Il,C as ci,S as We,b as Cf,f as Pf}from"./present-gVvLSOX3.js";/**
 * @license
 * Copyright 2010-2024 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const Ul="170",Lf=0,ic=1,Df=2,Ih=1,Uh=2,li=3,Ii=0,vn=1,Ln=2,Di=0,Zs=1,$n=2,sc=3,rc=4,If=5,Ji=100,Uf=101,Nf=102,Ff=103,Of=104,Bf=200,zf=201,kf=202,Hf=203,Oo=204,Bo=205,Gf=206,Vf=207,Wf=208,Xf=209,Yf=210,qf=211,Zf=212,Kf=213,$f=214,zo=0,ko=1,Ho=2,Js=3,Go=4,Vo=5,Wo=6,Xo=7,Nl=0,jf=1,Jf=2,fi=0,Qf=1,tu=2,eu=3,nu=4,iu=5,su=6,ru=7,Nh=300,Qs=301,tr=302,Yo=303,qo=304,Va=306,Zo=1e3,ts=1001,Ko=1002,Ne=1003,au=1004,Yr=1005,Yn=1006,ja=1007,Pi=1008,jn=1009,Fh=1010,Oh=1011,Br=1012,Fl=1013,ss=1014,qn=1015,ar=1016,Ol=1017,Bl=1018,er=1020,Bh=35902,zh=1021,kh=1022,Hn=1023,Hh=1024,Gh=1025,Ks=1026,nr=1027,zl=1028,kl=1029,Vh=1030,Hl=1031,Gl=1033,Ra=33776,Ca=33777,Pa=33778,La=33779,$o=35840,jo=35841,Jo=35842,Qo=35843,tl=36196,el=37492,nl=37496,il=37808,sl=37809,rl=37810,al=37811,ol=37812,ll=37813,cl=37814,hl=37815,fl=37816,ul=37817,dl=37818,pl=37819,ml=37820,gl=37821,Da=36492,_l=36494,xl=36495,Wh=36283,vl=36284,Ml=36285,Sl=36286,ou=3200,lu=3201,Xh=0,cu=1,Ci="",hn="srgb",ls="srgb-linear",Wa="linear",ge="srgb",ps=7680,ac=519,hu=512,fu=513,uu=514,Yh=515,du=516,pu=517,mu=518,gu=519,yl=35044,bl=35048,oc="300 es",hi=2e3,Oa=2001;class or{addEventListener(t,e){this._listeners===void 0&&(this._listeners={});const n=this._listeners;n[t]===void 0&&(n[t]=[]),n[t].indexOf(e)===-1&&n[t].push(e)}hasEventListener(t,e){if(this._listeners===void 0)return!1;const n=this._listeners;return n[t]!==void 0&&n[t].indexOf(e)!==-1}removeEventListener(t,e){if(this._listeners===void 0)return;const s=this._listeners[t];if(s!==void 0){const r=s.indexOf(e);r!==-1&&s.splice(r,1)}}dispatchEvent(t){if(this._listeners===void 0)return;const n=this._listeners[t.type];if(n!==void 0){t.target=this;const s=n.slice(0);for(let r=0,a=s.length;r<a;r++)s[r].call(this,t);t.target=null}}}const Je=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];let lc=1234567;const Fr=Math.PI/180,zr=180/Math.PI;function ui(){const i=Math.random()*4294967295|0,t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Je[i&255]+Je[i>>8&255]+Je[i>>16&255]+Je[i>>24&255]+"-"+Je[t&255]+Je[t>>8&255]+"-"+Je[t>>16&15|64]+Je[t>>24&255]+"-"+Je[e&63|128]+Je[e>>8&255]+"-"+Je[e>>16&255]+Je[e>>24&255]+Je[n&255]+Je[n>>8&255]+Je[n>>16&255]+Je[n>>24&255]).toLowerCase()}function fn(i,t,e){return Math.max(t,Math.min(e,i))}function Vl(i,t){return(i%t+t)%t}function _u(i,t,e,n,s){return n+(i-t)*(s-n)/(e-t)}function xu(i,t,e){return i!==t?(e-i)/(t-i):0}function Or(i,t,e){return(1-e)*i+e*t}function vu(i,t,e,n){return Or(i,t,1-Math.exp(-e*n))}function Mu(i,t=1){return t-Math.abs(Vl(i,t*2)-t)}function Su(i,t,e){return i<=t?0:i>=e?1:(i=(i-t)/(e-t),i*i*(3-2*i))}function yu(i,t,e){return i<=t?0:i>=e?1:(i=(i-t)/(e-t),i*i*i*(i*(i*6-15)+10))}function bu(i,t){return i+Math.floor(Math.random()*(t-i+1))}function Eu(i,t){return i+Math.random()*(t-i)}function wu(i){return i*(.5-Math.random())}function Tu(i){i!==void 0&&(lc=i);let t=lc+=1831565813;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}function Au(i){return i*Fr}function Ru(i){return i*zr}function Cu(i){return(i&i-1)===0&&i!==0}function Pu(i){return Math.pow(2,Math.ceil(Math.log(i)/Math.LN2))}function Lu(i){return Math.pow(2,Math.floor(Math.log(i)/Math.LN2))}function Du(i,t,e,n,s){const r=Math.cos,a=Math.sin,o=r(e/2),l=a(e/2),c=r((t+n)/2),f=a((t+n)/2),h=r((t-n)/2),u=a((t-n)/2),p=r((n-t)/2),g=a((n-t)/2);switch(s){case"XYX":i.set(o*f,l*h,l*u,o*c);break;case"YZY":i.set(l*u,o*f,l*h,o*c);break;case"ZXZ":i.set(l*h,l*u,o*f,o*c);break;case"XZX":i.set(o*f,l*g,l*p,o*c);break;case"YXY":i.set(l*p,o*f,l*g,o*c);break;case"ZYZ":i.set(l*g,l*p,o*f,o*c);break;default:console.warn("THREE.MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+s)}}function kn(i,t){switch(t.constructor){case Float32Array:return i;case Uint32Array:return i/4294967295;case Uint16Array:return i/65535;case Uint8Array:return i/255;case Int32Array:return Math.max(i/2147483647,-1);case Int16Array:return Math.max(i/32767,-1);case Int8Array:return Math.max(i/127,-1);default:throw new Error("Invalid component type.")}}function fe(i,t){switch(t.constructor){case Float32Array:return i;case Uint32Array:return Math.round(i*4294967295);case Uint16Array:return Math.round(i*65535);case Uint8Array:return Math.round(i*255);case Int32Array:return Math.round(i*2147483647);case Int16Array:return Math.round(i*32767);case Int8Array:return Math.round(i*127);default:throw new Error("Invalid component type.")}}const qr={DEG2RAD:Fr,RAD2DEG:zr,generateUUID:ui,clamp:fn,euclideanModulo:Vl,mapLinear:_u,inverseLerp:xu,lerp:Or,damp:vu,pingpong:Mu,smoothstep:Su,smootherstep:yu,randInt:bu,randFloat:Eu,randFloatSpread:wu,seededRandom:Tu,degToRad:Au,radToDeg:Ru,isPowerOfTwo:Cu,ceilPowerOfTwo:Pu,floorPowerOfTwo:Lu,setQuaternionFromProperEuler:Du,normalize:fe,denormalize:kn};class Yt{constructor(t=0,e=0){Yt.prototype.isVector2=!0,this.x=t,this.y=e}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,e){return this.x=t,this.y=e,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){const e=this.x,n=this.y,s=t.elements;return this.x=s[0]*e+s[3]*n+s[6],this.y=s[1]*e+s[4]*n+s[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){const e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;const n=this.dot(t)/e;return Math.acos(fn(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const e=this.x-t.x,n=this.y-t.y;return e*e+n*n}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this}rotateAround(t,e){const n=Math.cos(e),s=Math.sin(e),r=this.x-t.x,a=this.y-t.y;return this.x=r*n-a*s+t.x,this.y=r*s+a*n+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class Ht{constructor(t,e,n,s,r,a,o,l,c){Ht.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,e,n,s,r,a,o,l,c)}set(t,e,n,s,r,a,o,l,c){const f=this.elements;return f[0]=t,f[1]=s,f[2]=o,f[3]=e,f[4]=r,f[5]=l,f[6]=n,f[7]=a,f[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){const e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],this}extractBasis(t,e,n){return t.setFromMatrix3Column(this,0),e.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(t){const e=t.elements;return this.set(e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){const n=t.elements,s=e.elements,r=this.elements,a=n[0],o=n[3],l=n[6],c=n[1],f=n[4],h=n[7],u=n[2],p=n[5],g=n[8],_=s[0],m=s[3],d=s[6],E=s[1],y=s[4],S=s[7],O=s[2],T=s[5],R=s[8];return r[0]=a*_+o*E+l*O,r[3]=a*m+o*y+l*T,r[6]=a*d+o*S+l*R,r[1]=c*_+f*E+h*O,r[4]=c*m+f*y+h*T,r[7]=c*d+f*S+h*R,r[2]=u*_+p*E+g*O,r[5]=u*m+p*y+g*T,r[8]=u*d+p*S+g*R,this}multiplyScalar(t){const e=this.elements;return e[0]*=t,e[3]*=t,e[6]*=t,e[1]*=t,e[4]*=t,e[7]*=t,e[2]*=t,e[5]*=t,e[8]*=t,this}determinant(){const t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],a=t[4],o=t[5],l=t[6],c=t[7],f=t[8];return e*a*f-e*o*c-n*r*f+n*o*l+s*r*c-s*a*l}invert(){const t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],a=t[4],o=t[5],l=t[6],c=t[7],f=t[8],h=f*a-o*c,u=o*l-f*r,p=c*r-a*l,g=e*h+n*u+s*p;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);const _=1/g;return t[0]=h*_,t[1]=(s*c-f*n)*_,t[2]=(o*n-s*a)*_,t[3]=u*_,t[4]=(f*e-s*l)*_,t[5]=(s*r-o*e)*_,t[6]=p*_,t[7]=(n*l-c*e)*_,t[8]=(a*e-n*r)*_,this}transpose(){let t;const e=this.elements;return t=e[1],e[1]=e[3],e[3]=t,t=e[2],e[2]=e[6],e[6]=t,t=e[5],e[5]=e[7],e[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){const e=this.elements;return t[0]=e[0],t[1]=e[3],t[2]=e[6],t[3]=e[1],t[4]=e[4],t[5]=e[7],t[6]=e[2],t[7]=e[5],t[8]=e[8],this}setUvTransform(t,e,n,s,r,a,o){const l=Math.cos(r),c=Math.sin(r);return this.set(n*l,n*c,-n*(l*a+c*o)+a+t,-s*c,s*l,-s*(-c*a+l*o)+o+e,0,0,1),this}scale(t,e){return this.premultiply(Ja.makeScale(t,e)),this}rotate(t){return this.premultiply(Ja.makeRotation(-t)),this}translate(t,e){return this.premultiply(Ja.makeTranslation(t,e)),this}makeTranslation(t,e){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,e,0,0,1),this}makeRotation(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,n,e,0,0,0,1),this}makeScale(t,e){return this.set(t,0,0,0,e,0,0,0,1),this}equals(t){const e=this.elements,n=t.elements;for(let s=0;s<9;s++)if(e[s]!==n[s])return!1;return!0}fromArray(t,e=0){for(let n=0;n<9;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){const n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t}clone(){return new this.constructor().fromArray(this.elements)}}const Ja=new Ht;function qh(i){for(let t=i.length-1;t>=0;--t)if(i[t]>=65535)return!0;return!1}function Ba(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}function Iu(){const i=Ba("canvas");return i.style.display="block",i}const cc={};function Ur(i){i in cc||(cc[i]=!0,console.warn(i))}function Uu(i,t,e){return new Promise(function(n,s){function r(){switch(i.clientWaitSync(t,i.SYNC_FLUSH_COMMANDS_BIT,0)){case i.WAIT_FAILED:s();break;case i.TIMEOUT_EXPIRED:setTimeout(r,e);break;default:n()}}setTimeout(r,e)})}function Nu(i){const t=i.elements;t[2]=.5*t[2]+.5*t[3],t[6]=.5*t[6]+.5*t[7],t[10]=.5*t[10]+.5*t[11],t[14]=.5*t[14]+.5*t[15]}function Fu(i){const t=i.elements;t[11]===-1?(t[10]=-t[10]-1,t[14]=-t[14]):(t[10]=-t[10],t[14]=-t[14]+1)}const ae={enabled:!0,workingColorSpace:ls,spaces:{},convert:function(i,t,e){return this.enabled===!1||t===e||!t||!e||(this.spaces[t].transfer===ge&&(i.r=di(i.r),i.g=di(i.g),i.b=di(i.b)),this.spaces[t].primaries!==this.spaces[e].primaries&&(i.applyMatrix3(this.spaces[t].toXYZ),i.applyMatrix3(this.spaces[e].fromXYZ)),this.spaces[e].transfer===ge&&(i.r=$s(i.r),i.g=$s(i.g),i.b=$s(i.b))),i},fromWorkingColorSpace:function(i,t){return this.convert(i,this.workingColorSpace,t)},toWorkingColorSpace:function(i,t){return this.convert(i,t,this.workingColorSpace)},getPrimaries:function(i){return this.spaces[i].primaries},getTransfer:function(i){return i===Ci?Wa:this.spaces[i].transfer},getLuminanceCoefficients:function(i,t=this.workingColorSpace){return i.fromArray(this.spaces[t].luminanceCoefficients)},define:function(i){Object.assign(this.spaces,i)},_getMatrix:function(i,t,e){return i.copy(this.spaces[t].toXYZ).multiply(this.spaces[e].fromXYZ)},_getDrawingBufferColorSpace:function(i){return this.spaces[i].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(i=this.workingColorSpace){return this.spaces[i].workingColorSpaceConfig.unpackColorSpace}};function di(i){return i<.04045?i*.0773993808:Math.pow(i*.9478672986+.0521327014,2.4)}function $s(i){return i<.0031308?i*12.92:1.055*Math.pow(i,.41666)-.055}const hc=[.64,.33,.3,.6,.15,.06],fc=[.2126,.7152,.0722],uc=[.3127,.329],dc=new Ht().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),pc=new Ht().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);ae.define({[ls]:{primaries:hc,whitePoint:uc,transfer:Wa,toXYZ:dc,fromXYZ:pc,luminanceCoefficients:fc,workingColorSpaceConfig:{unpackColorSpace:hn},outputColorSpaceConfig:{drawingBufferColorSpace:hn}},[hn]:{primaries:hc,whitePoint:uc,transfer:ge,toXYZ:dc,fromXYZ:pc,luminanceCoefficients:fc,outputColorSpaceConfig:{drawingBufferColorSpace:hn}}});let ms;class Ou{static getDataURL(t){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement>"u")return t.src;let e;if(t instanceof HTMLCanvasElement)e=t;else{ms===void 0&&(ms=Ba("canvas")),ms.width=t.width,ms.height=t.height;const n=ms.getContext("2d");t instanceof ImageData?n.putImageData(t,0,0):n.drawImage(t,0,0,t.width,t.height),e=ms}return e.width>2048||e.height>2048?(console.warn("THREE.ImageUtils.getDataURL: Image converted to jpg for performance reasons",t),e.toDataURL("image/jpeg",.6)):e.toDataURL("image/png")}static sRGBToLinear(t){if(typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap){const e=Ba("canvas");e.width=t.width,e.height=t.height;const n=e.getContext("2d");n.drawImage(t,0,0,t.width,t.height);const s=n.getImageData(0,0,t.width,t.height),r=s.data;for(let a=0;a<r.length;a++)r[a]=di(r[a]/255)*255;return n.putImageData(s,0,0),e}else if(t.data){const e=t.data.slice(0);for(let n=0;n<e.length;n++)e instanceof Uint8Array||e instanceof Uint8ClampedArray?e[n]=Math.floor(di(e[n]/255)*255):e[n]=di(e[n]);return{data:e,width:t.width,height:t.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}}let Bu=0;class Zh{constructor(t=null){this.isSource=!0,Object.defineProperty(this,"id",{value:Bu++}),this.uuid=ui(),this.data=t,this.dataReady=!0,this.version=0}set needsUpdate(t){t===!0&&this.version++}toJSON(t){const e=t===void 0||typeof t=="string";if(!e&&t.images[this.uuid]!==void 0)return t.images[this.uuid];const n={uuid:this.uuid,url:""},s=this.data;if(s!==null){let r;if(Array.isArray(s)){r=[];for(let a=0,o=s.length;a<o;a++)s[a].isDataTexture?r.push(Qa(s[a].image)):r.push(Qa(s[a]))}else r=Qa(s);n.url=r}return e||(t.images[this.uuid]=n),n}}function Qa(i){return typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&i instanceof ImageBitmap?Ou.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}let zu=0;class tn extends or{constructor(t=tn.DEFAULT_IMAGE,e=tn.DEFAULT_MAPPING,n=ts,s=ts,r=Yn,a=Pi,o=Hn,l=jn,c=tn.DEFAULT_ANISOTROPY,f=Ci){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:zu++}),this.uuid=ui(),this.name="",this.source=new Zh(t),this.mipmaps=[],this.mapping=e,this.channel=0,this.wrapS=n,this.wrapT=s,this.magFilter=r,this.minFilter=a,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new Yt(0,0),this.repeat=new Yt(1,1),this.center=new Yt(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Ht,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=f,this.userData={},this.version=0,this.onUpdate=null,this.isRenderTargetTexture=!1,this.pmremVersion=0}get image(){return this.source.data}set image(t=null){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}toJSON(t){const e=t===void 0||typeof t=="string";if(!e&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];const n={metadata:{version:4.6,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),e||(t.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==Nh)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case Zo:t.x=t.x-Math.floor(t.x);break;case ts:t.x=t.x<0?0:1;break;case Ko:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case Zo:t.y=t.y-Math.floor(t.y);break;case ts:t.y=t.y<0?0:1;break;case Ko:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(t){t===!0&&this.pmremVersion++}}tn.DEFAULT_IMAGE=null;tn.DEFAULT_MAPPING=Nh;tn.DEFAULT_ANISOTROPY=1;class Re{constructor(t=0,e=0,n=0,s=1){Re.prototype.isVector4=!0,this.x=t,this.y=e,this.z=n,this.w=s}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,e,n,s){return this.x=t,this.y=e,this.z=n,this.w=s,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;case 3:this.w=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this.w=t.w+e.w,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this.w+=t.w*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this.w=t.w-e.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){const e=this.x,n=this.y,s=this.z,r=this.w,a=t.elements;return this.x=a[0]*e+a[4]*n+a[8]*s+a[12]*r,this.y=a[1]*e+a[5]*n+a[9]*s+a[13]*r,this.z=a[2]*e+a[6]*n+a[10]*s+a[14]*r,this.w=a[3]*e+a[7]*n+a[11]*s+a[15]*r,this}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this.w/=t.w,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);const e=Math.sqrt(1-t.w*t.w);return e<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/e,this.y=t.y/e,this.z=t.z/e),this}setAxisAngleFromRotationMatrix(t){let e,n,s,r;const l=t.elements,c=l[0],f=l[4],h=l[8],u=l[1],p=l[5],g=l[9],_=l[2],m=l[6],d=l[10];if(Math.abs(f-u)<.01&&Math.abs(h-_)<.01&&Math.abs(g-m)<.01){if(Math.abs(f+u)<.1&&Math.abs(h+_)<.1&&Math.abs(g+m)<.1&&Math.abs(c+p+d-3)<.1)return this.set(1,0,0,0),this;e=Math.PI;const y=(c+1)/2,S=(p+1)/2,O=(d+1)/2,T=(f+u)/4,R=(h+_)/4,I=(g+m)/4;return y>S&&y>O?y<.01?(n=0,s=.707106781,r=.707106781):(n=Math.sqrt(y),s=T/n,r=R/n):S>O?S<.01?(n=.707106781,s=0,r=.707106781):(s=Math.sqrt(S),n=T/s,r=I/s):O<.01?(n=.707106781,s=.707106781,r=0):(r=Math.sqrt(O),n=R/r,s=I/r),this.set(n,s,r,e),this}let E=Math.sqrt((m-g)*(m-g)+(h-_)*(h-_)+(u-f)*(u-f));return Math.abs(E)<.001&&(E=1),this.x=(m-g)/E,this.y=(h-_)/E,this.z=(u-f)/E,this.w=Math.acos((c+p+d-1)/2),this}setFromMatrixPosition(t){const e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this.w=e[15],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this.w=Math.max(t.w,Math.min(e.w,this.w)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this.w=Math.max(t,Math.min(e,this.w)),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this.w+=(t.w-this.w)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this.w=t.w+(e.w-t.w)*n,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this.w=t[e+3],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t[e+3]=this.w,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this.w=t.getW(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class ku extends or{constructor(t=1,e=1,n={}){super(),this.isRenderTarget=!0,this.width=t,this.height=e,this.depth=1,this.scissor=new Re(0,0,t,e),this.scissorTest=!1,this.viewport=new Re(0,0,t,e);const s={width:t,height:e,depth:1};n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Yn,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1},n);const r=new tn(s,n.mapping,n.wrapS,n.wrapT,n.magFilter,n.minFilter,n.format,n.type,n.anisotropy,n.colorSpace);r.flipY=!1,r.generateMipmaps=n.generateMipmaps,r.internalFormat=n.internalFormat,this.textures=[];const a=n.count;for(let o=0;o<a;o++)this.textures[o]=r.clone(),this.textures[o].isRenderTargetTexture=!0;this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.depthTexture=n.depthTexture,this.samples=n.samples}get texture(){return this.textures[0]}set texture(t){this.textures[0]=t}setSize(t,e,n=1){if(this.width!==t||this.height!==e||this.depth!==n){this.width=t,this.height=e,this.depth=n;for(let s=0,r=this.textures.length;s<r;s++)this.textures[s].image.width=t,this.textures[s].image.height=e,this.textures[s].image.depth=n;this.dispose()}this.viewport.set(0,0,t,e),this.scissor.set(0,0,t,e)}clone(){return new this.constructor().copy(this)}copy(t){this.width=t.width,this.height=t.height,this.depth=t.depth,this.scissor.copy(t.scissor),this.scissorTest=t.scissorTest,this.viewport.copy(t.viewport),this.textures.length=0;for(let n=0,s=t.textures.length;n<s;n++)this.textures[n]=t.textures[n].clone(),this.textures[n].isRenderTargetTexture=!0;const e=Object.assign({},t.texture.image);return this.texture.source=new Zh(e),this.depthBuffer=t.depthBuffer,this.stencilBuffer=t.stencilBuffer,this.resolveDepthBuffer=t.resolveDepthBuffer,this.resolveStencilBuffer=t.resolveStencilBuffer,t.depthTexture!==null&&(this.depthTexture=t.depthTexture.clone()),this.samples=t.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}}class Ui extends ku{constructor(t=1,e=1,n={}){super(t,e,n),this.isWebGLRenderTarget=!0}}class Kh extends tn{constructor(t=null,e=1,n=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:t,width:e,height:n,depth:s},this.magFilter=Ne,this.minFilter=Ne,this.wrapR=ts,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(t){this.layerUpdates.add(t)}clearLayerUpdates(){this.layerUpdates.clear()}}class Hu extends tn{constructor(t=null,e=1,n=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:t,width:e,height:n,depth:s},this.magFilter=Ne,this.minFilter=Ne,this.wrapR=ts,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class cs{constructor(t=0,e=0,n=0,s=1){this.isQuaternion=!0,this._x=t,this._y=e,this._z=n,this._w=s}static slerpFlat(t,e,n,s,r,a,o){let l=n[s+0],c=n[s+1],f=n[s+2],h=n[s+3];const u=r[a+0],p=r[a+1],g=r[a+2],_=r[a+3];if(o===0){t[e+0]=l,t[e+1]=c,t[e+2]=f,t[e+3]=h;return}if(o===1){t[e+0]=u,t[e+1]=p,t[e+2]=g,t[e+3]=_;return}if(h!==_||l!==u||c!==p||f!==g){let m=1-o;const d=l*u+c*p+f*g+h*_,E=d>=0?1:-1,y=1-d*d;if(y>Number.EPSILON){const O=Math.sqrt(y),T=Math.atan2(O,d*E);m=Math.sin(m*T)/O,o=Math.sin(o*T)/O}const S=o*E;if(l=l*m+u*S,c=c*m+p*S,f=f*m+g*S,h=h*m+_*S,m===1-o){const O=1/Math.sqrt(l*l+c*c+f*f+h*h);l*=O,c*=O,f*=O,h*=O}}t[e]=l,t[e+1]=c,t[e+2]=f,t[e+3]=h}static multiplyQuaternionsFlat(t,e,n,s,r,a){const o=n[s],l=n[s+1],c=n[s+2],f=n[s+3],h=r[a],u=r[a+1],p=r[a+2],g=r[a+3];return t[e]=o*g+f*h+l*p-c*u,t[e+1]=l*g+f*u+c*h-o*p,t[e+2]=c*g+f*p+o*u-l*h,t[e+3]=f*g-o*h-l*u-c*p,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,e,n,s){return this._x=t,this._y=e,this._z=n,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,e=!0){const n=t._x,s=t._y,r=t._z,a=t._order,o=Math.cos,l=Math.sin,c=o(n/2),f=o(s/2),h=o(r/2),u=l(n/2),p=l(s/2),g=l(r/2);switch(a){case"XYZ":this._x=u*f*h+c*p*g,this._y=c*p*h-u*f*g,this._z=c*f*g+u*p*h,this._w=c*f*h-u*p*g;break;case"YXZ":this._x=u*f*h+c*p*g,this._y=c*p*h-u*f*g,this._z=c*f*g-u*p*h,this._w=c*f*h+u*p*g;break;case"ZXY":this._x=u*f*h-c*p*g,this._y=c*p*h+u*f*g,this._z=c*f*g+u*p*h,this._w=c*f*h-u*p*g;break;case"ZYX":this._x=u*f*h-c*p*g,this._y=c*p*h+u*f*g,this._z=c*f*g-u*p*h,this._w=c*f*h+u*p*g;break;case"YZX":this._x=u*f*h+c*p*g,this._y=c*p*h+u*f*g,this._z=c*f*g-u*p*h,this._w=c*f*h-u*p*g;break;case"XZY":this._x=u*f*h-c*p*g,this._y=c*p*h-u*f*g,this._z=c*f*g+u*p*h,this._w=c*f*h+u*p*g;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+a)}return e===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,e){const n=e/2,s=Math.sin(n);return this._x=t.x*s,this._y=t.y*s,this._z=t.z*s,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(t){const e=t.elements,n=e[0],s=e[4],r=e[8],a=e[1],o=e[5],l=e[9],c=e[2],f=e[6],h=e[10],u=n+o+h;if(u>0){const p=.5/Math.sqrt(u+1);this._w=.25/p,this._x=(f-l)*p,this._y=(r-c)*p,this._z=(a-s)*p}else if(n>o&&n>h){const p=2*Math.sqrt(1+n-o-h);this._w=(f-l)/p,this._x=.25*p,this._y=(s+a)/p,this._z=(r+c)/p}else if(o>h){const p=2*Math.sqrt(1+o-n-h);this._w=(r-c)/p,this._x=(s+a)/p,this._y=.25*p,this._z=(l+f)/p}else{const p=2*Math.sqrt(1+h-n-o);this._w=(a-s)/p,this._x=(r+c)/p,this._y=(l+f)/p,this._z=.25*p}return this._onChangeCallback(),this}setFromUnitVectors(t,e){let n=t.dot(e)+1;return n<Number.EPSILON?(n=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=n):(this._x=0,this._y=-t.z,this._z=t.y,this._w=n)):(this._x=t.y*e.z-t.z*e.y,this._y=t.z*e.x-t.x*e.z,this._z=t.x*e.y-t.y*e.x,this._w=n),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(fn(this.dot(t),-1,1)))}rotateTowards(t,e){const n=this.angleTo(t);if(n===0)return this;const s=Math.min(1,e/n);return this.slerp(t,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,e){const n=t._x,s=t._y,r=t._z,a=t._w,o=e._x,l=e._y,c=e._z,f=e._w;return this._x=n*f+a*o+s*c-r*l,this._y=s*f+a*l+r*o-n*c,this._z=r*f+a*c+n*l-s*o,this._w=a*f-n*o-s*l-r*c,this._onChangeCallback(),this}slerp(t,e){if(e===0)return this;if(e===1)return this.copy(t);const n=this._x,s=this._y,r=this._z,a=this._w;let o=a*t._w+n*t._x+s*t._y+r*t._z;if(o<0?(this._w=-t._w,this._x=-t._x,this._y=-t._y,this._z=-t._z,o=-o):this.copy(t),o>=1)return this._w=a,this._x=n,this._y=s,this._z=r,this;const l=1-o*o;if(l<=Number.EPSILON){const p=1-e;return this._w=p*a+e*this._w,this._x=p*n+e*this._x,this._y=p*s+e*this._y,this._z=p*r+e*this._z,this.normalize(),this}const c=Math.sqrt(l),f=Math.atan2(c,o),h=Math.sin((1-e)*f)/c,u=Math.sin(e*f)/c;return this._w=a*h+this._w*u,this._x=n*h+this._x*u,this._y=s*h+this._y*u,this._z=r*h+this._z*u,this._onChangeCallback(),this}slerpQuaternions(t,e,n){return this.copy(t).slerp(e,n)}random(){const t=2*Math.PI*Math.random(),e=2*Math.PI*Math.random(),n=Math.random(),s=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(s*Math.sin(t),s*Math.cos(t),r*Math.sin(e),r*Math.cos(e))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,e=0){return this._x=t[e],this._y=t[e+1],this._z=t[e+2],this._w=t[e+3],this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._w,t}fromBufferAttribute(t,e){return this._x=t.getX(e),this._y=t.getY(e),this._z=t.getZ(e),this._w=t.getW(e),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class F{constructor(t=0,e=0,n=0){F.prototype.isVector3=!0,this.x=t,this.y=e,this.z=n}set(t,e,n){return n===void 0&&(n=this.z),this.x=t,this.y=e,this.z=n,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,e){return this.x=t.x*e.x,this.y=t.y*e.y,this.z=t.z*e.z,this}applyEuler(t){return this.applyQuaternion(mc.setFromEuler(t))}applyAxisAngle(t,e){return this.applyQuaternion(mc.setFromAxisAngle(t,e))}applyMatrix3(t){const e=this.x,n=this.y,s=this.z,r=t.elements;return this.x=r[0]*e+r[3]*n+r[6]*s,this.y=r[1]*e+r[4]*n+r[7]*s,this.z=r[2]*e+r[5]*n+r[8]*s,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){const e=this.x,n=this.y,s=this.z,r=t.elements,a=1/(r[3]*e+r[7]*n+r[11]*s+r[15]);return this.x=(r[0]*e+r[4]*n+r[8]*s+r[12])*a,this.y=(r[1]*e+r[5]*n+r[9]*s+r[13])*a,this.z=(r[2]*e+r[6]*n+r[10]*s+r[14])*a,this}applyQuaternion(t){const e=this.x,n=this.y,s=this.z,r=t.x,a=t.y,o=t.z,l=t.w,c=2*(a*s-o*n),f=2*(o*e-r*s),h=2*(r*n-a*e);return this.x=e+l*c+a*h-o*f,this.y=n+l*f+o*c-r*h,this.z=s+l*h+r*f-a*c,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){const e=this.x,n=this.y,s=this.z,r=t.elements;return this.x=r[0]*e+r[4]*n+r[8]*s,this.y=r[1]*e+r[5]*n+r[9]*s,this.z=r[2]*e+r[6]*n+r[10]*s,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,e){const n=t.x,s=t.y,r=t.z,a=e.x,o=e.y,l=e.z;return this.x=s*l-r*o,this.y=r*a-n*l,this.z=n*o-s*a,this}projectOnVector(t){const e=t.lengthSq();if(e===0)return this.set(0,0,0);const n=t.dot(this)/e;return this.copy(t).multiplyScalar(n)}projectOnPlane(t){return to.copy(this).projectOnVector(t),this.sub(to)}reflect(t){return this.sub(to.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){const e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;const n=this.dot(t)/e;return Math.acos(fn(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const e=this.x-t.x,n=this.y-t.y,s=this.z-t.z;return e*e+n*n+s*s}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,e,n){const s=Math.sin(e)*t;return this.x=s*Math.sin(n),this.y=Math.cos(e)*t,this.z=s*Math.cos(n),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,e,n){return this.x=t*Math.sin(e),this.y=n,this.z=t*Math.cos(e),this}setFromMatrixPosition(t){const e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this}setFromMatrixScale(t){const e=this.setFromMatrixColumn(t,0).length(),n=this.setFromMatrixColumn(t,1).length(),s=this.setFromMatrixColumn(t,2).length();return this.x=e,this.y=n,this.z=s,this}setFromMatrixColumn(t,e){return this.fromArray(t.elements,e*4)}setFromMatrix3Column(t,e){return this.fromArray(t.elements,e*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const t=Math.random()*Math.PI*2,e=Math.random()*2-1,n=Math.sqrt(1-e*e);return this.x=n*Math.cos(t),this.y=e,this.z=n*Math.sin(t),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const to=new F,mc=new cs;class hs{constructor(t=new F(1/0,1/0,1/0),e=new F(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=e}set(t,e){return this.min.copy(t),this.max.copy(e),this}setFromArray(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e+=3)this.expandByPoint(Fn.fromArray(t,e));return this}setFromBufferAttribute(t){this.makeEmpty();for(let e=0,n=t.count;e<n;e++)this.expandByPoint(Fn.fromBufferAttribute(t,e));return this}setFromPoints(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e++)this.expandByPoint(t[e]);return this}setFromCenterAndSize(t,e){const n=Fn.copy(e).multiplyScalar(.5);return this.min.copy(t).sub(n),this.max.copy(t).add(n),this}setFromObject(t,e=!1){return this.makeEmpty(),this.expandByObject(t,e)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,e=!1){t.updateWorldMatrix(!1,!1);const n=t.geometry;if(n!==void 0){const r=n.getAttribute("position");if(e===!0&&r!==void 0&&t.isInstancedMesh!==!0)for(let a=0,o=r.count;a<o;a++)t.isMesh===!0?t.getVertexPosition(a,Fn):Fn.fromBufferAttribute(r,a),Fn.applyMatrix4(t.matrixWorld),this.expandByPoint(Fn);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),Zr.copy(t.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),Zr.copy(n.boundingBox)),Zr.applyMatrix4(t.matrixWorld),this.union(Zr)}const s=t.children;for(let r=0,a=s.length;r<a;r++)this.expandByObject(s[r],e);return this}containsPoint(t){return t.x>=this.min.x&&t.x<=this.max.x&&t.y>=this.min.y&&t.y<=this.max.y&&t.z>=this.min.z&&t.z<=this.max.z}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,e){return e.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return t.max.x>=this.min.x&&t.min.x<=this.max.x&&t.max.y>=this.min.y&&t.min.y<=this.max.y&&t.max.z>=this.min.z&&t.min.z<=this.max.z}intersectsSphere(t){return this.clampPoint(t.center,Fn),Fn.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let e,n;return t.normal.x>0?(e=t.normal.x*this.min.x,n=t.normal.x*this.max.x):(e=t.normal.x*this.max.x,n=t.normal.x*this.min.x),t.normal.y>0?(e+=t.normal.y*this.min.y,n+=t.normal.y*this.max.y):(e+=t.normal.y*this.max.y,n+=t.normal.y*this.min.y),t.normal.z>0?(e+=t.normal.z*this.min.z,n+=t.normal.z*this.max.z):(e+=t.normal.z*this.max.z,n+=t.normal.z*this.min.z),e<=-t.constant&&n>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(gr),Kr.subVectors(this.max,gr),gs.subVectors(t.a,gr),_s.subVectors(t.b,gr),xs.subVectors(t.c,gr),Mi.subVectors(_s,gs),Si.subVectors(xs,_s),zi.subVectors(gs,xs);let e=[0,-Mi.z,Mi.y,0,-Si.z,Si.y,0,-zi.z,zi.y,Mi.z,0,-Mi.x,Si.z,0,-Si.x,zi.z,0,-zi.x,-Mi.y,Mi.x,0,-Si.y,Si.x,0,-zi.y,zi.x,0];return!eo(e,gs,_s,xs,Kr)||(e=[1,0,0,0,1,0,0,0,1],!eo(e,gs,_s,xs,Kr))?!1:($r.crossVectors(Mi,Si),e=[$r.x,$r.y,$r.z],eo(e,gs,_s,xs,Kr))}clampPoint(t,e){return e.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,Fn).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(Fn).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(ti[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),ti[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),ti[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),ti[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),ti[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),ti[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),ti[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),ti[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(ti),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}}const ti=[new F,new F,new F,new F,new F,new F,new F,new F],Fn=new F,Zr=new hs,gs=new F,_s=new F,xs=new F,Mi=new F,Si=new F,zi=new F,gr=new F,Kr=new F,$r=new F,ki=new F;function eo(i,t,e,n,s){for(let r=0,a=i.length-3;r<=a;r+=3){ki.fromArray(i,r);const o=s.x*Math.abs(ki.x)+s.y*Math.abs(ki.y)+s.z*Math.abs(ki.z),l=t.dot(ki),c=e.dot(ki),f=n.dot(ki);if(Math.max(-Math.max(l,c,f),Math.min(l,c,f))>o)return!1}return!0}const Gu=new hs,_r=new F,no=new F;class lr{constructor(t=new F,e=-1){this.isSphere=!0,this.center=t,this.radius=e}set(t,e){return this.center.copy(t),this.radius=e,this}setFromPoints(t,e){const n=this.center;e!==void 0?n.copy(e):Gu.setFromPoints(t).getCenter(n);let s=0;for(let r=0,a=t.length;r<a;r++)s=Math.max(s,n.distanceToSquared(t[r]));return this.radius=Math.sqrt(s),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){const e=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=e*e}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,e){const n=this.center.distanceToSquared(t);return e.copy(t),n>this.radius*this.radius&&(e.sub(this.center).normalize(),e.multiplyScalar(this.radius).add(this.center)),e}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;_r.subVectors(t,this.center);const e=_r.lengthSq();if(e>this.radius*this.radius){const n=Math.sqrt(e),s=(n-this.radius)*.5;this.center.addScaledVector(_r,s/n),this.radius+=s}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):(no.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(_r.copy(t.center).add(no)),this.expandByPoint(_r.copy(t.center).sub(no))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}}const ei=new F,io=new F,jr=new F,yi=new F,so=new F,Jr=new F,ro=new F;class $h{constructor(t=new F,e=new F(0,0,-1)){this.origin=t,this.direction=e}set(t,e){return this.origin.copy(t),this.direction.copy(e),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,e){return e.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,ei)),this}closestPointToPoint(t,e){e.subVectors(t,this.origin);const n=e.dot(this.direction);return n<0?e.copy(this.origin):e.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){const e=ei.subVectors(t,this.origin).dot(this.direction);return e<0?this.origin.distanceToSquared(t):(ei.copy(this.origin).addScaledVector(this.direction,e),ei.distanceToSquared(t))}distanceSqToSegment(t,e,n,s){io.copy(t).add(e).multiplyScalar(.5),jr.copy(e).sub(t).normalize(),yi.copy(this.origin).sub(io);const r=t.distanceTo(e)*.5,a=-this.direction.dot(jr),o=yi.dot(this.direction),l=-yi.dot(jr),c=yi.lengthSq(),f=Math.abs(1-a*a);let h,u,p,g;if(f>0)if(h=a*l-o,u=a*o-l,g=r*f,h>=0)if(u>=-g)if(u<=g){const _=1/f;h*=_,u*=_,p=h*(h+a*u+2*o)+u*(a*h+u+2*l)+c}else u=r,h=Math.max(0,-(a*u+o)),p=-h*h+u*(u+2*l)+c;else u=-r,h=Math.max(0,-(a*u+o)),p=-h*h+u*(u+2*l)+c;else u<=-g?(h=Math.max(0,-(-a*r+o)),u=h>0?-r:Math.min(Math.max(-r,-l),r),p=-h*h+u*(u+2*l)+c):u<=g?(h=0,u=Math.min(Math.max(-r,-l),r),p=u*(u+2*l)+c):(h=Math.max(0,-(a*r+o)),u=h>0?r:Math.min(Math.max(-r,-l),r),p=-h*h+u*(u+2*l)+c);else u=a>0?-r:r,h=Math.max(0,-(a*u+o)),p=-h*h+u*(u+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,h),s&&s.copy(io).addScaledVector(jr,u),p}intersectSphere(t,e){ei.subVectors(t.center,this.origin);const n=ei.dot(this.direction),s=ei.dot(ei)-n*n,r=t.radius*t.radius;if(s>r)return null;const a=Math.sqrt(r-s),o=n-a,l=n+a;return l<0?null:o<0?this.at(l,e):this.at(o,e)}intersectsSphere(t){return this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){const e=t.normal.dot(this.direction);if(e===0)return t.distanceToPoint(this.origin)===0?0:null;const n=-(this.origin.dot(t.normal)+t.constant)/e;return n>=0?n:null}intersectPlane(t,e){const n=this.distanceToPlane(t);return n===null?null:this.at(n,e)}intersectsPlane(t){const e=t.distanceToPoint(this.origin);return e===0||t.normal.dot(this.direction)*e<0}intersectBox(t,e){let n,s,r,a,o,l;const c=1/this.direction.x,f=1/this.direction.y,h=1/this.direction.z,u=this.origin;return c>=0?(n=(t.min.x-u.x)*c,s=(t.max.x-u.x)*c):(n=(t.max.x-u.x)*c,s=(t.min.x-u.x)*c),f>=0?(r=(t.min.y-u.y)*f,a=(t.max.y-u.y)*f):(r=(t.max.y-u.y)*f,a=(t.min.y-u.y)*f),n>a||r>s||((r>n||isNaN(n))&&(n=r),(a<s||isNaN(s))&&(s=a),h>=0?(o=(t.min.z-u.z)*h,l=(t.max.z-u.z)*h):(o=(t.max.z-u.z)*h,l=(t.min.z-u.z)*h),n>l||o>s)||((o>n||n!==n)&&(n=o),(l<s||s!==s)&&(s=l),s<0)?null:this.at(n>=0?n:s,e)}intersectsBox(t){return this.intersectBox(t,ei)!==null}intersectTriangle(t,e,n,s,r){so.subVectors(e,t),Jr.subVectors(n,t),ro.crossVectors(so,Jr);let a=this.direction.dot(ro),o;if(a>0){if(s)return null;o=1}else if(a<0)o=-1,a=-a;else return null;yi.subVectors(this.origin,t);const l=o*this.direction.dot(Jr.crossVectors(yi,Jr));if(l<0)return null;const c=o*this.direction.dot(so.cross(yi));if(c<0||l+c>a)return null;const f=-o*yi.dot(ro);return f<0?null:this.at(f/a,r)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class ue{constructor(t,e,n,s,r,a,o,l,c,f,h,u,p,g,_,m){ue.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,e,n,s,r,a,o,l,c,f,h,u,p,g,_,m)}set(t,e,n,s,r,a,o,l,c,f,h,u,p,g,_,m){const d=this.elements;return d[0]=t,d[4]=e,d[8]=n,d[12]=s,d[1]=r,d[5]=a,d[9]=o,d[13]=l,d[2]=c,d[6]=f,d[10]=h,d[14]=u,d[3]=p,d[7]=g,d[11]=_,d[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new ue().fromArray(this.elements)}copy(t){const e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],e[9]=n[9],e[10]=n[10],e[11]=n[11],e[12]=n[12],e[13]=n[13],e[14]=n[14],e[15]=n[15],this}copyPosition(t){const e=this.elements,n=t.elements;return e[12]=n[12],e[13]=n[13],e[14]=n[14],this}setFromMatrix3(t){const e=t.elements;return this.set(e[0],e[3],e[6],0,e[1],e[4],e[7],0,e[2],e[5],e[8],0,0,0,0,1),this}extractBasis(t,e,n){return t.setFromMatrixColumn(this,0),e.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this}makeBasis(t,e,n){return this.set(t.x,e.x,n.x,0,t.y,e.y,n.y,0,t.z,e.z,n.z,0,0,0,0,1),this}extractRotation(t){const e=this.elements,n=t.elements,s=1/vs.setFromMatrixColumn(t,0).length(),r=1/vs.setFromMatrixColumn(t,1).length(),a=1/vs.setFromMatrixColumn(t,2).length();return e[0]=n[0]*s,e[1]=n[1]*s,e[2]=n[2]*s,e[3]=0,e[4]=n[4]*r,e[5]=n[5]*r,e[6]=n[6]*r,e[7]=0,e[8]=n[8]*a,e[9]=n[9]*a,e[10]=n[10]*a,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromEuler(t){const e=this.elements,n=t.x,s=t.y,r=t.z,a=Math.cos(n),o=Math.sin(n),l=Math.cos(s),c=Math.sin(s),f=Math.cos(r),h=Math.sin(r);if(t.order==="XYZ"){const u=a*f,p=a*h,g=o*f,_=o*h;e[0]=l*f,e[4]=-l*h,e[8]=c,e[1]=p+g*c,e[5]=u-_*c,e[9]=-o*l,e[2]=_-u*c,e[6]=g+p*c,e[10]=a*l}else if(t.order==="YXZ"){const u=l*f,p=l*h,g=c*f,_=c*h;e[0]=u+_*o,e[4]=g*o-p,e[8]=a*c,e[1]=a*h,e[5]=a*f,e[9]=-o,e[2]=p*o-g,e[6]=_+u*o,e[10]=a*l}else if(t.order==="ZXY"){const u=l*f,p=l*h,g=c*f,_=c*h;e[0]=u-_*o,e[4]=-a*h,e[8]=g+p*o,e[1]=p+g*o,e[5]=a*f,e[9]=_-u*o,e[2]=-a*c,e[6]=o,e[10]=a*l}else if(t.order==="ZYX"){const u=a*f,p=a*h,g=o*f,_=o*h;e[0]=l*f,e[4]=g*c-p,e[8]=u*c+_,e[1]=l*h,e[5]=_*c+u,e[9]=p*c-g,e[2]=-c,e[6]=o*l,e[10]=a*l}else if(t.order==="YZX"){const u=a*l,p=a*c,g=o*l,_=o*c;e[0]=l*f,e[4]=_-u*h,e[8]=g*h+p,e[1]=h,e[5]=a*f,e[9]=-o*f,e[2]=-c*f,e[6]=p*h+g,e[10]=u-_*h}else if(t.order==="XZY"){const u=a*l,p=a*c,g=o*l,_=o*c;e[0]=l*f,e[4]=-h,e[8]=c*f,e[1]=u*h+_,e[5]=a*f,e[9]=p*h-g,e[2]=g*h-p,e[6]=o*f,e[10]=_*h+u}return e[3]=0,e[7]=0,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromQuaternion(t){return this.compose(Vu,t,Wu)}lookAt(t,e,n){const s=this.elements;return yn.subVectors(t,e),yn.lengthSq()===0&&(yn.z=1),yn.normalize(),bi.crossVectors(n,yn),bi.lengthSq()===0&&(Math.abs(n.z)===1?yn.x+=1e-4:yn.z+=1e-4,yn.normalize(),bi.crossVectors(n,yn)),bi.normalize(),Qr.crossVectors(yn,bi),s[0]=bi.x,s[4]=Qr.x,s[8]=yn.x,s[1]=bi.y,s[5]=Qr.y,s[9]=yn.y,s[2]=bi.z,s[6]=Qr.z,s[10]=yn.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){const n=t.elements,s=e.elements,r=this.elements,a=n[0],o=n[4],l=n[8],c=n[12],f=n[1],h=n[5],u=n[9],p=n[13],g=n[2],_=n[6],m=n[10],d=n[14],E=n[3],y=n[7],S=n[11],O=n[15],T=s[0],R=s[4],I=s[8],b=s[12],M=s[1],A=s[5],V=s[9],z=s[13],C=s[2],W=s[6],G=s[10],Z=s[14],H=s[3],it=s[7],ot=s[11],gt=s[15];return r[0]=a*T+o*M+l*C+c*H,r[4]=a*R+o*A+l*W+c*it,r[8]=a*I+o*V+l*G+c*ot,r[12]=a*b+o*z+l*Z+c*gt,r[1]=f*T+h*M+u*C+p*H,r[5]=f*R+h*A+u*W+p*it,r[9]=f*I+h*V+u*G+p*ot,r[13]=f*b+h*z+u*Z+p*gt,r[2]=g*T+_*M+m*C+d*H,r[6]=g*R+_*A+m*W+d*it,r[10]=g*I+_*V+m*G+d*ot,r[14]=g*b+_*z+m*Z+d*gt,r[3]=E*T+y*M+S*C+O*H,r[7]=E*R+y*A+S*W+O*it,r[11]=E*I+y*V+S*G+O*ot,r[15]=E*b+y*z+S*Z+O*gt,this}multiplyScalar(t){const e=this.elements;return e[0]*=t,e[4]*=t,e[8]*=t,e[12]*=t,e[1]*=t,e[5]*=t,e[9]*=t,e[13]*=t,e[2]*=t,e[6]*=t,e[10]*=t,e[14]*=t,e[3]*=t,e[7]*=t,e[11]*=t,e[15]*=t,this}determinant(){const t=this.elements,e=t[0],n=t[4],s=t[8],r=t[12],a=t[1],o=t[5],l=t[9],c=t[13],f=t[2],h=t[6],u=t[10],p=t[14],g=t[3],_=t[7],m=t[11],d=t[15];return g*(+r*l*h-s*c*h-r*o*u+n*c*u+s*o*p-n*l*p)+_*(+e*l*p-e*c*u+r*a*u-s*a*p+s*c*f-r*l*f)+m*(+e*c*h-e*o*p-r*a*h+n*a*p+r*o*f-n*c*f)+d*(-s*o*f-e*l*h+e*o*u+s*a*h-n*a*u+n*l*f)}transpose(){const t=this.elements;let e;return e=t[1],t[1]=t[4],t[4]=e,e=t[2],t[2]=t[8],t[8]=e,e=t[6],t[6]=t[9],t[9]=e,e=t[3],t[3]=t[12],t[12]=e,e=t[7],t[7]=t[13],t[13]=e,e=t[11],t[11]=t[14],t[14]=e,this}setPosition(t,e,n){const s=this.elements;return t.isVector3?(s[12]=t.x,s[13]=t.y,s[14]=t.z):(s[12]=t,s[13]=e,s[14]=n),this}invert(){const t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],a=t[4],o=t[5],l=t[6],c=t[7],f=t[8],h=t[9],u=t[10],p=t[11],g=t[12],_=t[13],m=t[14],d=t[15],E=h*m*c-_*u*c+_*l*p-o*m*p-h*l*d+o*u*d,y=g*u*c-f*m*c-g*l*p+a*m*p+f*l*d-a*u*d,S=f*_*c-g*h*c+g*o*p-a*_*p-f*o*d+a*h*d,O=g*h*l-f*_*l-g*o*u+a*_*u+f*o*m-a*h*m,T=e*E+n*y+s*S+r*O;if(T===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const R=1/T;return t[0]=E*R,t[1]=(_*u*r-h*m*r-_*s*p+n*m*p+h*s*d-n*u*d)*R,t[2]=(o*m*r-_*l*r+_*s*c-n*m*c-o*s*d+n*l*d)*R,t[3]=(h*l*r-o*u*r-h*s*c+n*u*c+o*s*p-n*l*p)*R,t[4]=y*R,t[5]=(f*m*r-g*u*r+g*s*p-e*m*p-f*s*d+e*u*d)*R,t[6]=(g*l*r-a*m*r-g*s*c+e*m*c+a*s*d-e*l*d)*R,t[7]=(a*u*r-f*l*r+f*s*c-e*u*c-a*s*p+e*l*p)*R,t[8]=S*R,t[9]=(g*h*r-f*_*r-g*n*p+e*_*p+f*n*d-e*h*d)*R,t[10]=(a*_*r-g*o*r+g*n*c-e*_*c-a*n*d+e*o*d)*R,t[11]=(f*o*r-a*h*r-f*n*c+e*h*c+a*n*p-e*o*p)*R,t[12]=O*R,t[13]=(f*_*s-g*h*s+g*n*u-e*_*u-f*n*m+e*h*m)*R,t[14]=(g*o*s-a*_*s-g*n*l+e*_*l+a*n*m-e*o*m)*R,t[15]=(a*h*s-f*o*s+f*n*l-e*h*l-a*n*u+e*o*u)*R,this}scale(t){const e=this.elements,n=t.x,s=t.y,r=t.z;return e[0]*=n,e[4]*=s,e[8]*=r,e[1]*=n,e[5]*=s,e[9]*=r,e[2]*=n,e[6]*=s,e[10]*=r,e[3]*=n,e[7]*=s,e[11]*=r,this}getMaxScaleOnAxis(){const t=this.elements,e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],n=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],s=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(e,n,s))}makeTranslation(t,e,n){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,e,0,0,1,n,0,0,0,1),this}makeRotationX(t){const e=Math.cos(t),n=Math.sin(t);return this.set(1,0,0,0,0,e,-n,0,0,n,e,0,0,0,0,1),this}makeRotationY(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,0,n,0,0,1,0,0,-n,0,e,0,0,0,0,1),this}makeRotationZ(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,0,n,e,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,e){const n=Math.cos(e),s=Math.sin(e),r=1-n,a=t.x,o=t.y,l=t.z,c=r*a,f=r*o;return this.set(c*a+n,c*o-s*l,c*l+s*o,0,c*o+s*l,f*o+n,f*l-s*a,0,c*l-s*o,f*l+s*a,r*l*l+n,0,0,0,0,1),this}makeScale(t,e,n){return this.set(t,0,0,0,0,e,0,0,0,0,n,0,0,0,0,1),this}makeShear(t,e,n,s,r,a){return this.set(1,n,r,0,t,1,a,0,e,s,1,0,0,0,0,1),this}compose(t,e,n){const s=this.elements,r=e._x,a=e._y,o=e._z,l=e._w,c=r+r,f=a+a,h=o+o,u=r*c,p=r*f,g=r*h,_=a*f,m=a*h,d=o*h,E=l*c,y=l*f,S=l*h,O=n.x,T=n.y,R=n.z;return s[0]=(1-(_+d))*O,s[1]=(p+S)*O,s[2]=(g-y)*O,s[3]=0,s[4]=(p-S)*T,s[5]=(1-(u+d))*T,s[6]=(m+E)*T,s[7]=0,s[8]=(g+y)*R,s[9]=(m-E)*R,s[10]=(1-(u+_))*R,s[11]=0,s[12]=t.x,s[13]=t.y,s[14]=t.z,s[15]=1,this}decompose(t,e,n){const s=this.elements;let r=vs.set(s[0],s[1],s[2]).length();const a=vs.set(s[4],s[5],s[6]).length(),o=vs.set(s[8],s[9],s[10]).length();this.determinant()<0&&(r=-r),t.x=s[12],t.y=s[13],t.z=s[14],On.copy(this);const c=1/r,f=1/a,h=1/o;return On.elements[0]*=c,On.elements[1]*=c,On.elements[2]*=c,On.elements[4]*=f,On.elements[5]*=f,On.elements[6]*=f,On.elements[8]*=h,On.elements[9]*=h,On.elements[10]*=h,e.setFromRotationMatrix(On),n.x=r,n.y=a,n.z=o,this}makePerspective(t,e,n,s,r,a,o=hi){const l=this.elements,c=2*r/(e-t),f=2*r/(n-s),h=(e+t)/(e-t),u=(n+s)/(n-s);let p,g;if(o===hi)p=-(a+r)/(a-r),g=-2*a*r/(a-r);else if(o===Oa)p=-a/(a-r),g=-a*r/(a-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return l[0]=c,l[4]=0,l[8]=h,l[12]=0,l[1]=0,l[5]=f,l[9]=u,l[13]=0,l[2]=0,l[6]=0,l[10]=p,l[14]=g,l[3]=0,l[7]=0,l[11]=-1,l[15]=0,this}makeOrthographic(t,e,n,s,r,a,o=hi){const l=this.elements,c=1/(e-t),f=1/(n-s),h=1/(a-r),u=(e+t)*c,p=(n+s)*f;let g,_;if(o===hi)g=(a+r)*h,_=-2*h;else if(o===Oa)g=r*h,_=-1*h;else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return l[0]=2*c,l[4]=0,l[8]=0,l[12]=-u,l[1]=0,l[5]=2*f,l[9]=0,l[13]=-p,l[2]=0,l[6]=0,l[10]=_,l[14]=-g,l[3]=0,l[7]=0,l[11]=0,l[15]=1,this}equals(t){const e=this.elements,n=t.elements;for(let s=0;s<16;s++)if(e[s]!==n[s])return!1;return!0}fromArray(t,e=0){for(let n=0;n<16;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){const n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t[e+9]=n[9],t[e+10]=n[10],t[e+11]=n[11],t[e+12]=n[12],t[e+13]=n[13],t[e+14]=n[14],t[e+15]=n[15],t}}const vs=new F,On=new ue,Vu=new F(0,0,0),Wu=new F(1,1,1),bi=new F,Qr=new F,yn=new F,gc=new ue,_c=new cs;class In{constructor(t=0,e=0,n=0,s=In.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=e,this._z=n,this._order=s}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,e,n,s=this._order){return this._x=t,this._y=e,this._z=n,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,e=this._order,n=!0){const s=t.elements,r=s[0],a=s[4],o=s[8],l=s[1],c=s[5],f=s[9],h=s[2],u=s[6],p=s[10];switch(e){case"XYZ":this._y=Math.asin(fn(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-f,p),this._z=Math.atan2(-a,r)):(this._x=Math.atan2(u,c),this._z=0);break;case"YXZ":this._x=Math.asin(-fn(f,-1,1)),Math.abs(f)<.9999999?(this._y=Math.atan2(o,p),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-h,r),this._z=0);break;case"ZXY":this._x=Math.asin(fn(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(-h,p),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-fn(h,-1,1)),Math.abs(h)<.9999999?(this._x=Math.atan2(u,p),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-a,c));break;case"YZX":this._z=Math.asin(fn(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-f,c),this._y=Math.atan2(-h,r)):(this._x=0,this._y=Math.atan2(o,p));break;case"XZY":this._z=Math.asin(-fn(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(u,c),this._y=Math.atan2(o,r)):(this._x=Math.atan2(-f,p),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+e)}return this._order=e,n===!0&&this._onChangeCallback(),this}setFromQuaternion(t,e,n){return gc.makeRotationFromQuaternion(t),this.setFromRotationMatrix(gc,e,n)}setFromVector3(t,e=this._order){return this.set(t.x,t.y,t.z,e)}reorder(t){return _c.setFromEuler(this),this.setFromQuaternion(_c,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}In.DEFAULT_ORDER="XYZ";class jh{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}}let Xu=0;const xc=new F,Ms=new cs,ni=new ue,ta=new F,xr=new F,Yu=new F,qu=new cs,vc=new F(1,0,0),Mc=new F(0,1,0),Sc=new F(0,0,1),yc={type:"added"},Zu={type:"removed"},Ss={type:"childadded",child:null},ao={type:"childremoved",child:null};class Oe extends or{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Xu++}),this.uuid=ui(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=Oe.DEFAULT_UP.clone();const t=new F,e=new In,n=new cs,s=new F(1,1,1);function r(){n.setFromEuler(e,!1)}function a(){e.setFromQuaternion(n,void 0,!1)}e._onChange(r),n._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:e},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new ue},normalMatrix:{value:new Ht}}),this.matrix=new ue,this.matrixWorld=new ue,this.matrixAutoUpdate=Oe.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=Oe.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new jh,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,e){this.quaternion.setFromAxisAngle(t,e)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,e){return Ms.setFromAxisAngle(t,e),this.quaternion.multiply(Ms),this}rotateOnWorldAxis(t,e){return Ms.setFromAxisAngle(t,e),this.quaternion.premultiply(Ms),this}rotateX(t){return this.rotateOnAxis(vc,t)}rotateY(t){return this.rotateOnAxis(Mc,t)}rotateZ(t){return this.rotateOnAxis(Sc,t)}translateOnAxis(t,e){return xc.copy(t).applyQuaternion(this.quaternion),this.position.add(xc.multiplyScalar(e)),this}translateX(t){return this.translateOnAxis(vc,t)}translateY(t){return this.translateOnAxis(Mc,t)}translateZ(t){return this.translateOnAxis(Sc,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(ni.copy(this.matrixWorld).invert())}lookAt(t,e,n){t.isVector3?ta.copy(t):ta.set(t,e,n);const s=this.parent;this.updateWorldMatrix(!0,!1),xr.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?ni.lookAt(xr,ta,this.up):ni.lookAt(ta,xr,this.up),this.quaternion.setFromRotationMatrix(ni),s&&(ni.extractRotation(s.matrixWorld),Ms.setFromRotationMatrix(ni),this.quaternion.premultiply(Ms.invert()))}add(t){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return t===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.removeFromParent(),t.parent=this,this.children.push(t),t.dispatchEvent(yc),Ss.child=t,this.dispatchEvent(Ss),Ss.child=null):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}const e=this.children.indexOf(t);return e!==-1&&(t.parent=null,this.children.splice(e,1),t.dispatchEvent(Zu),ao.child=t,this.dispatchEvent(ao),ao.child=null),this}removeFromParent(){const t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),ni.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),ni.multiply(t.parent.matrixWorld)),t.applyMatrix4(ni),t.removeFromParent(),t.parent=this,this.children.push(t),t.updateWorldMatrix(!1,!0),t.dispatchEvent(yc),Ss.child=t,this.dispatchEvent(Ss),Ss.child=null,this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,e){if(this[t]===e)return this;for(let n=0,s=this.children.length;n<s;n++){const a=this.children[n].getObjectByProperty(t,e);if(a!==void 0)return a}}getObjectsByProperty(t,e,n=[]){this[t]===e&&n.push(this);const s=this.children;for(let r=0,a=s.length;r<a;r++)s[r].getObjectsByProperty(t,e,n);return n}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(xr,t,Yu),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(xr,qu,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);const e=this.matrixWorld.elements;return t.set(e[8],e[9],e[10]).normalize()}raycast(){}traverse(t){t(this);const e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);const e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].traverseVisible(t)}traverseAncestors(t){const e=this.parent;e!==null&&(t(e),e.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,t=!0);const e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].updateMatrixWorld(t)}updateWorldMatrix(t,e){const n=this.parent;if(t===!0&&n!==null&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),e===!0){const s=this.children;for(let r=0,a=s.length;r<a;r++)s[r].updateWorldMatrix(!1,!0)}}toJSON(t){const e=t===void 0||typeof t=="string",n={};e&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.6,type:"Object",generator:"Object3D.toJSON"});const s={};s.uuid=this.uuid,s.type=this.type,this.name!==""&&(s.name=this.name),this.castShadow===!0&&(s.castShadow=!0),this.receiveShadow===!0&&(s.receiveShadow=!0),this.visible===!1&&(s.visible=!1),this.frustumCulled===!1&&(s.frustumCulled=!1),this.renderOrder!==0&&(s.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(s.matrixAutoUpdate=!1),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.visibility=this._visibility,s.active=this._active,s.bounds=this._bounds.map(o=>({boxInitialized:o.boxInitialized,boxMin:o.box.min.toArray(),boxMax:o.box.max.toArray(),sphereInitialized:o.sphereInitialized,sphereRadius:o.sphere.radius,sphereCenter:o.sphere.center.toArray()})),s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.geometryCount=this._geometryCount,s.matricesTexture=this._matricesTexture.toJSON(t),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(t)),this.boundingSphere!==null&&(s.boundingSphere={center:s.boundingSphere.center.toArray(),radius:s.boundingSphere.radius}),this.boundingBox!==null&&(s.boundingBox={min:s.boundingBox.min.toArray(),max:s.boundingBox.max.toArray()}));function r(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(t)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=r(t.geometries,this.geometry);const o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){const l=o.shapes;if(Array.isArray(l))for(let c=0,f=l.length;c<f;c++){const h=l[c];r(t.shapes,h)}else r(t.shapes,l)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(t.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(r(t.materials,this.material[l]));s.material=o}else s.material=r(t.materials,this.material);if(this.children.length>0){s.children=[];for(let o=0;o<this.children.length;o++)s.children.push(this.children[o].toJSON(t).object)}if(this.animations.length>0){s.animations=[];for(let o=0;o<this.animations.length;o++){const l=this.animations[o];s.animations.push(r(t.animations,l))}}if(e){const o=a(t.geometries),l=a(t.materials),c=a(t.textures),f=a(t.images),h=a(t.shapes),u=a(t.skeletons),p=a(t.animations),g=a(t.nodes);o.length>0&&(n.geometries=o),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),f.length>0&&(n.images=f),h.length>0&&(n.shapes=h),u.length>0&&(n.skeletons=u),p.length>0&&(n.animations=p),g.length>0&&(n.nodes=g)}return n.object=s,n;function a(o){const l=[];for(const c in o){const f=o[c];delete f.metadata,l.push(f)}return l}}clone(t){return new this.constructor().copy(this,t)}copy(t,e=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),e===!0)for(let n=0;n<t.children.length;n++){const s=t.children[n];this.add(s.clone())}return this}}Oe.DEFAULT_UP=new F(0,1,0);Oe.DEFAULT_MATRIX_AUTO_UPDATE=!0;Oe.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;const Bn=new F,ii=new F,oo=new F,si=new F,ys=new F,bs=new F,bc=new F,lo=new F,co=new F,ho=new F,fo=new Re,uo=new Re,po=new Re;class Dn{constructor(t=new F,e=new F,n=new F){this.a=t,this.b=e,this.c=n}static getNormal(t,e,n,s){s.subVectors(n,e),Bn.subVectors(t,e),s.cross(Bn);const r=s.lengthSq();return r>0?s.multiplyScalar(1/Math.sqrt(r)):s.set(0,0,0)}static getBarycoord(t,e,n,s,r){Bn.subVectors(s,e),ii.subVectors(n,e),oo.subVectors(t,e);const a=Bn.dot(Bn),o=Bn.dot(ii),l=Bn.dot(oo),c=ii.dot(ii),f=ii.dot(oo),h=a*c-o*o;if(h===0)return r.set(0,0,0),null;const u=1/h,p=(c*l-o*f)*u,g=(a*f-o*l)*u;return r.set(1-p-g,g,p)}static containsPoint(t,e,n,s){return this.getBarycoord(t,e,n,s,si)===null?!1:si.x>=0&&si.y>=0&&si.x+si.y<=1}static getInterpolation(t,e,n,s,r,a,o,l){return this.getBarycoord(t,e,n,s,si)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,si.x),l.addScaledVector(a,si.y),l.addScaledVector(o,si.z),l)}static getInterpolatedAttribute(t,e,n,s,r,a){return fo.setScalar(0),uo.setScalar(0),po.setScalar(0),fo.fromBufferAttribute(t,e),uo.fromBufferAttribute(t,n),po.fromBufferAttribute(t,s),a.setScalar(0),a.addScaledVector(fo,r.x),a.addScaledVector(uo,r.y),a.addScaledVector(po,r.z),a}static isFrontFacing(t,e,n,s){return Bn.subVectors(n,e),ii.subVectors(t,e),Bn.cross(ii).dot(s)<0}set(t,e,n){return this.a.copy(t),this.b.copy(e),this.c.copy(n),this}setFromPointsAndIndices(t,e,n,s){return this.a.copy(t[e]),this.b.copy(t[n]),this.c.copy(t[s]),this}setFromAttributeAndIndices(t,e,n,s){return this.a.fromBufferAttribute(t,e),this.b.fromBufferAttribute(t,n),this.c.fromBufferAttribute(t,s),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return Bn.subVectors(this.c,this.b),ii.subVectors(this.a,this.b),Bn.cross(ii).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return Dn.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,e){return Dn.getBarycoord(t,this.a,this.b,this.c,e)}getInterpolation(t,e,n,s,r){return Dn.getInterpolation(t,this.a,this.b,this.c,e,n,s,r)}containsPoint(t){return Dn.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return Dn.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,e){const n=this.a,s=this.b,r=this.c;let a,o;ys.subVectors(s,n),bs.subVectors(r,n),lo.subVectors(t,n);const l=ys.dot(lo),c=bs.dot(lo);if(l<=0&&c<=0)return e.copy(n);co.subVectors(t,s);const f=ys.dot(co),h=bs.dot(co);if(f>=0&&h<=f)return e.copy(s);const u=l*h-f*c;if(u<=0&&l>=0&&f<=0)return a=l/(l-f),e.copy(n).addScaledVector(ys,a);ho.subVectors(t,r);const p=ys.dot(ho),g=bs.dot(ho);if(g>=0&&p<=g)return e.copy(r);const _=p*c-l*g;if(_<=0&&c>=0&&g<=0)return o=c/(c-g),e.copy(n).addScaledVector(bs,o);const m=f*g-p*h;if(m<=0&&h-f>=0&&p-g>=0)return bc.subVectors(r,s),o=(h-f)/(h-f+(p-g)),e.copy(s).addScaledVector(bc,o);const d=1/(m+_+u);return a=_*d,o=u*d,e.copy(n).addScaledVector(ys,a).addScaledVector(bs,o)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}}const Jh={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Ei={h:0,s:0,l:0},ea={h:0,s:0,l:0};function mo(i,t,e){return e<0&&(e+=1),e>1&&(e-=1),e<1/6?i+(t-i)*6*e:e<1/2?t:e<2/3?i+(t-i)*6*(2/3-e):i}class Tt{constructor(t,e,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,e,n)}set(t,e,n){if(e===void 0&&n===void 0){const s=t;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(t,e,n);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,e=hn){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,ae.toWorkingColorSpace(this,e),this}setRGB(t,e,n,s=ae.workingColorSpace){return this.r=t,this.g=e,this.b=n,ae.toWorkingColorSpace(this,s),this}setHSL(t,e,n,s=ae.workingColorSpace){if(t=Vl(t,1),e=fn(e,0,1),n=fn(n,0,1),e===0)this.r=this.g=this.b=n;else{const r=n<=.5?n*(1+e):n+e-n*e,a=2*n-r;this.r=mo(a,r,t+1/3),this.g=mo(a,r,t),this.b=mo(a,r,t-1/3)}return ae.toWorkingColorSpace(this,s),this}setStyle(t,e=hn){function n(r){r!==void 0&&parseFloat(r)<1&&console.warn("THREE.Color: Alpha component of "+t+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(t)){let r;const a=s[1],o=s[2];switch(a){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,e);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,e);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,e);break;default:console.warn("THREE.Color: Unknown color model "+t)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(t)){const r=s[1],a=r.length;if(a===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,e);if(a===6)return this.setHex(parseInt(r,16),e);console.warn("THREE.Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,e);return this}setColorName(t,e=hn){const n=Jh[t.toLowerCase()];return n!==void 0?this.setHex(n,e):console.warn("THREE.Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=di(t.r),this.g=di(t.g),this.b=di(t.b),this}copyLinearToSRGB(t){return this.r=$s(t.r),this.g=$s(t.g),this.b=$s(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=hn){return ae.fromWorkingColorSpace(Qe.copy(this),t),Math.round(fn(Qe.r*255,0,255))*65536+Math.round(fn(Qe.g*255,0,255))*256+Math.round(fn(Qe.b*255,0,255))}getHexString(t=hn){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,e=ae.workingColorSpace){ae.fromWorkingColorSpace(Qe.copy(this),e);const n=Qe.r,s=Qe.g,r=Qe.b,a=Math.max(n,s,r),o=Math.min(n,s,r);let l,c;const f=(o+a)/2;if(o===a)l=0,c=0;else{const h=a-o;switch(c=f<=.5?h/(a+o):h/(2-a-o),a){case n:l=(s-r)/h+(s<r?6:0);break;case s:l=(r-n)/h+2;break;case r:l=(n-s)/h+4;break}l/=6}return t.h=l,t.s=c,t.l=f,t}getRGB(t,e=ae.workingColorSpace){return ae.fromWorkingColorSpace(Qe.copy(this),e),t.r=Qe.r,t.g=Qe.g,t.b=Qe.b,t}getStyle(t=hn){ae.fromWorkingColorSpace(Qe.copy(this),t);const e=Qe.r,n=Qe.g,s=Qe.b;return t!==hn?`color(${t} ${e.toFixed(3)} ${n.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(e*255)},${Math.round(n*255)},${Math.round(s*255)})`}offsetHSL(t,e,n){return this.getHSL(Ei),this.setHSL(Ei.h+t,Ei.s+e,Ei.l+n)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,e){return this.r=t.r+e.r,this.g=t.g+e.g,this.b=t.b+e.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,e){return this.r+=(t.r-this.r)*e,this.g+=(t.g-this.g)*e,this.b+=(t.b-this.b)*e,this}lerpColors(t,e,n){return this.r=t.r+(e.r-t.r)*n,this.g=t.g+(e.g-t.g)*n,this.b=t.b+(e.b-t.b)*n,this}lerpHSL(t,e){this.getHSL(Ei),t.getHSL(ea);const n=Or(Ei.h,ea.h,e),s=Or(Ei.s,ea.s,e),r=Or(Ei.l,ea.l,e);return this.setHSL(n,s,r),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){const e=this.r,n=this.g,s=this.b,r=t.elements;return this.r=r[0]*e+r[3]*n+r[6]*s,this.g=r[1]*e+r[4]*n+r[7]*s,this.b=r[2]*e+r[5]*n+r[8]*s,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,e=0){return this.r=t[e],this.g=t[e+1],this.b=t[e+2],this}toArray(t=[],e=0){return t[e]=this.r,t[e+1]=this.g,t[e+2]=this.b,t}fromBufferAttribute(t,e){return this.r=t.getX(e),this.g=t.getY(e),this.b=t.getZ(e),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const Qe=new Tt;Tt.NAMES=Jh;let Ku=0;class fs extends or{static get type(){return"Material"}get type(){return this.constructor.type}set type(t){}constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Ku++}),this.uuid=ui(),this.name="",this.blending=Zs,this.side=Ii,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=Oo,this.blendDst=Bo,this.blendEquation=Ji,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Tt(0,0,0),this.blendAlpha=0,this.depthFunc=Js,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=ac,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=ps,this.stencilZFail=ps,this.stencilZPass=ps,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(const e in t){const n=t[e];if(n===void 0){console.warn(`THREE.Material: parameter '${e}' has value of undefined.`);continue}const s=this[e];if(s===void 0){console.warn(`THREE.Material: '${e}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(n):s&&s.isVector3&&n&&n.isVector3?s.copy(n):this[e]=n}}toJSON(t){const e=t===void 0||typeof t=="string";e&&(t={textures:{},images:{}});const n={metadata:{version:4.6,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(t).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(t).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(t).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(t).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(t).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==Zs&&(n.blending=this.blending),this.side!==Ii&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==Oo&&(n.blendSrc=this.blendSrc),this.blendDst!==Bo&&(n.blendDst=this.blendDst),this.blendEquation!==Ji&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==Js&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==ac&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==ps&&(n.stencilFail=this.stencilFail),this.stencilZFail!==ps&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==ps&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function s(r){const a=[];for(const o in r){const l=r[o];delete l.metadata,a.push(l)}return a}if(e){const r=s(t.textures),a=s(t.images);r.length>0&&(n.textures=r),a.length>0&&(n.images=a)}return n}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;const e=t.clippingPlanes;let n=null;if(e!==null){const s=e.length;n=new Array(s);for(let r=0;r!==s;++r)n[r]=e[r].clone()}return this.clippingPlanes=n,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}onBuild(){console.warn("Material: onBuild() has been removed.")}}class Xt extends fs{static get type(){return"MeshBasicMaterial"}constructor(t){super(),this.isMeshBasicMaterial=!0,this.color=new Tt(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new In,this.combine=Nl,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}}const De=new F,na=new Yt;class mn{constructor(t,e,n=!1){if(Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,this.name="",this.array=t,this.itemSize=e,this.count=t!==void 0?t.length/e:0,this.normalized=n,this.usage=yl,this.updateRanges=[],this.gpuType=qn,this.version=0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this}copyAt(t,e,n){t*=this.itemSize,n*=e.itemSize;for(let s=0,r=this.itemSize;s<r;s++)this.array[t+s]=e.array[n+s];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let e=0,n=this.count;e<n;e++)na.fromBufferAttribute(this,e),na.applyMatrix3(t),this.setXY(e,na.x,na.y);else if(this.itemSize===3)for(let e=0,n=this.count;e<n;e++)De.fromBufferAttribute(this,e),De.applyMatrix3(t),this.setXYZ(e,De.x,De.y,De.z);return this}applyMatrix4(t){for(let e=0,n=this.count;e<n;e++)De.fromBufferAttribute(this,e),De.applyMatrix4(t),this.setXYZ(e,De.x,De.y,De.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)De.fromBufferAttribute(this,e),De.applyNormalMatrix(t),this.setXYZ(e,De.x,De.y,De.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)De.fromBufferAttribute(this,e),De.transformDirection(t),this.setXYZ(e,De.x,De.y,De.z);return this}set(t,e=0){return this.array.set(t,e),this}getComponent(t,e){let n=this.array[t*this.itemSize+e];return this.normalized&&(n=kn(n,this.array)),n}setComponent(t,e,n){return this.normalized&&(n=fe(n,this.array)),this.array[t*this.itemSize+e]=n,this}getX(t){let e=this.array[t*this.itemSize];return this.normalized&&(e=kn(e,this.array)),e}setX(t,e){return this.normalized&&(e=fe(e,this.array)),this.array[t*this.itemSize]=e,this}getY(t){let e=this.array[t*this.itemSize+1];return this.normalized&&(e=kn(e,this.array)),e}setY(t,e){return this.normalized&&(e=fe(e,this.array)),this.array[t*this.itemSize+1]=e,this}getZ(t){let e=this.array[t*this.itemSize+2];return this.normalized&&(e=kn(e,this.array)),e}setZ(t,e){return this.normalized&&(e=fe(e,this.array)),this.array[t*this.itemSize+2]=e,this}getW(t){let e=this.array[t*this.itemSize+3];return this.normalized&&(e=kn(e,this.array)),e}setW(t,e){return this.normalized&&(e=fe(e,this.array)),this.array[t*this.itemSize+3]=e,this}setXY(t,e,n){return t*=this.itemSize,this.normalized&&(e=fe(e,this.array),n=fe(n,this.array)),this.array[t+0]=e,this.array[t+1]=n,this}setXYZ(t,e,n,s){return t*=this.itemSize,this.normalized&&(e=fe(e,this.array),n=fe(n,this.array),s=fe(s,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=s,this}setXYZW(t,e,n,s,r){return t*=this.itemSize,this.normalized&&(e=fe(e,this.array),n=fe(n,this.array),s=fe(s,this.array),r=fe(r,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=s,this.array[t+3]=r,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(t.name=this.name),this.usage!==yl&&(t.usage=this.usage),t}}class Wl extends mn{constructor(t,e,n){super(new Uint16Array(t),e,n)}}class Xl extends mn{constructor(t,e,n){super(new Uint32Array(t),e,n)}}class Ce extends mn{constructor(t,e,n){super(new Float32Array(t),e,n)}}let $u=0;const An=new ue,go=new Oe,Es=new F,bn=new hs,vr=new hs,ke=new F;class Ge extends or{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:$u++}),this.uuid=ui(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(qh(t)?Xl:Wl)(t,1):this.index=t,this}setIndirect(t){return this.indirect=t,this}getIndirect(){return this.indirect}getAttribute(t){return this.attributes[t]}setAttribute(t,e){return this.attributes[t]=e,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,e,n=0){this.groups.push({start:t,count:e,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(t,e){this.drawRange.start=t,this.drawRange.count=e}applyMatrix4(t){const e=this.attributes.position;e!==void 0&&(e.applyMatrix4(t),e.needsUpdate=!0);const n=this.attributes.normal;if(n!==void 0){const r=new Ht().getNormalMatrix(t);n.applyNormalMatrix(r),n.needsUpdate=!0}const s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(t),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(t){return An.makeRotationFromQuaternion(t),this.applyMatrix4(An),this}rotateX(t){return An.makeRotationX(t),this.applyMatrix4(An),this}rotateY(t){return An.makeRotationY(t),this.applyMatrix4(An),this}rotateZ(t){return An.makeRotationZ(t),this.applyMatrix4(An),this}translate(t,e,n){return An.makeTranslation(t,e,n),this.applyMatrix4(An),this}scale(t,e,n){return An.makeScale(t,e,n),this.applyMatrix4(An),this}lookAt(t){return go.lookAt(t),go.updateMatrix(),this.applyMatrix4(go.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(Es).negate(),this.translate(Es.x,Es.y,Es.z),this}setFromPoints(t){const e=this.getAttribute("position");if(e===void 0){const n=[];for(let s=0,r=t.length;s<r;s++){const a=t[s];n.push(a.x,a.y,a.z||0)}this.setAttribute("position",new Ce(n,3))}else{for(let n=0,s=e.count;n<s;n++){const r=t[n];e.setXYZ(n,r.x,r.y,r.z||0)}t.length>e.count&&console.warn("THREE.BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),e.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new hs);const t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new F(-1/0,-1/0,-1/0),new F(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),e)for(let n=0,s=e.length;n<s;n++){const r=e[n];bn.setFromBufferAttribute(r),this.morphTargetsRelative?(ke.addVectors(this.boundingBox.min,bn.min),this.boundingBox.expandByPoint(ke),ke.addVectors(this.boundingBox.max,bn.max),this.boundingBox.expandByPoint(ke)):(this.boundingBox.expandByPoint(bn.min),this.boundingBox.expandByPoint(bn.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new lr);const t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new F,1/0);return}if(t){const n=this.boundingSphere.center;if(bn.setFromBufferAttribute(t),e)for(let r=0,a=e.length;r<a;r++){const o=e[r];vr.setFromBufferAttribute(o),this.morphTargetsRelative?(ke.addVectors(bn.min,vr.min),bn.expandByPoint(ke),ke.addVectors(bn.max,vr.max),bn.expandByPoint(ke)):(bn.expandByPoint(vr.min),bn.expandByPoint(vr.max))}bn.getCenter(n);let s=0;for(let r=0,a=t.count;r<a;r++)ke.fromBufferAttribute(t,r),s=Math.max(s,n.distanceToSquared(ke));if(e)for(let r=0,a=e.length;r<a;r++){const o=e[r],l=this.morphTargetsRelative;for(let c=0,f=o.count;c<f;c++)ke.fromBufferAttribute(o,c),l&&(Es.fromBufferAttribute(t,c),ke.add(Es)),s=Math.max(s,n.distanceToSquared(ke))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const t=this.index,e=this.attributes;if(t===null||e.position===void 0||e.normal===void 0||e.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const n=e.position,s=e.normal,r=e.uv;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new mn(new Float32Array(4*n.count),4));const a=this.getAttribute("tangent"),o=[],l=[];for(let I=0;I<n.count;I++)o[I]=new F,l[I]=new F;const c=new F,f=new F,h=new F,u=new Yt,p=new Yt,g=new Yt,_=new F,m=new F;function d(I,b,M){c.fromBufferAttribute(n,I),f.fromBufferAttribute(n,b),h.fromBufferAttribute(n,M),u.fromBufferAttribute(r,I),p.fromBufferAttribute(r,b),g.fromBufferAttribute(r,M),f.sub(c),h.sub(c),p.sub(u),g.sub(u);const A=1/(p.x*g.y-g.x*p.y);isFinite(A)&&(_.copy(f).multiplyScalar(g.y).addScaledVector(h,-p.y).multiplyScalar(A),m.copy(h).multiplyScalar(p.x).addScaledVector(f,-g.x).multiplyScalar(A),o[I].add(_),o[b].add(_),o[M].add(_),l[I].add(m),l[b].add(m),l[M].add(m))}let E=this.groups;E.length===0&&(E=[{start:0,count:t.count}]);for(let I=0,b=E.length;I<b;++I){const M=E[I],A=M.start,V=M.count;for(let z=A,C=A+V;z<C;z+=3)d(t.getX(z+0),t.getX(z+1),t.getX(z+2))}const y=new F,S=new F,O=new F,T=new F;function R(I){O.fromBufferAttribute(s,I),T.copy(O);const b=o[I];y.copy(b),y.sub(O.multiplyScalar(O.dot(b))).normalize(),S.crossVectors(T,b);const A=S.dot(l[I])<0?-1:1;a.setXYZW(I,y.x,y.y,y.z,A)}for(let I=0,b=E.length;I<b;++I){const M=E[I],A=M.start,V=M.count;for(let z=A,C=A+V;z<C;z+=3)R(t.getX(z+0)),R(t.getX(z+1)),R(t.getX(z+2))}}computeVertexNormals(){const t=this.index,e=this.getAttribute("position");if(e!==void 0){let n=this.getAttribute("normal");if(n===void 0)n=new mn(new Float32Array(e.count*3),3),this.setAttribute("normal",n);else for(let u=0,p=n.count;u<p;u++)n.setXYZ(u,0,0,0);const s=new F,r=new F,a=new F,o=new F,l=new F,c=new F,f=new F,h=new F;if(t)for(let u=0,p=t.count;u<p;u+=3){const g=t.getX(u+0),_=t.getX(u+1),m=t.getX(u+2);s.fromBufferAttribute(e,g),r.fromBufferAttribute(e,_),a.fromBufferAttribute(e,m),f.subVectors(a,r),h.subVectors(s,r),f.cross(h),o.fromBufferAttribute(n,g),l.fromBufferAttribute(n,_),c.fromBufferAttribute(n,m),o.add(f),l.add(f),c.add(f),n.setXYZ(g,o.x,o.y,o.z),n.setXYZ(_,l.x,l.y,l.z),n.setXYZ(m,c.x,c.y,c.z)}else for(let u=0,p=e.count;u<p;u+=3)s.fromBufferAttribute(e,u+0),r.fromBufferAttribute(e,u+1),a.fromBufferAttribute(e,u+2),f.subVectors(a,r),h.subVectors(s,r),f.cross(h),n.setXYZ(u+0,f.x,f.y,f.z),n.setXYZ(u+1,f.x,f.y,f.z),n.setXYZ(u+2,f.x,f.y,f.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){const t=this.attributes.normal;for(let e=0,n=t.count;e<n;e++)ke.fromBufferAttribute(t,e),ke.normalize(),t.setXYZ(e,ke.x,ke.y,ke.z)}toNonIndexed(){function t(o,l){const c=o.array,f=o.itemSize,h=o.normalized,u=new c.constructor(l.length*f);let p=0,g=0;for(let _=0,m=l.length;_<m;_++){o.isInterleavedBufferAttribute?p=l[_]*o.data.stride+o.offset:p=l[_]*f;for(let d=0;d<f;d++)u[g++]=c[p++]}return new mn(u,f,h)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const e=new Ge,n=this.index.array,s=this.attributes;for(const o in s){const l=s[o],c=t(l,n);e.setAttribute(o,c)}const r=this.morphAttributes;for(const o in r){const l=[],c=r[o];for(let f=0,h=c.length;f<h;f++){const u=c[f],p=t(u,n);l.push(p)}e.morphAttributes[o]=l}e.morphTargetsRelative=this.morphTargetsRelative;const a=this.groups;for(let o=0,l=a.length;o<l;o++){const c=a[o];e.addGroup(c.start,c.count,c.materialIndex)}return e}toJSON(){const t={metadata:{version:4.6,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.type,this.name!==""&&(t.name=this.name),Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0){const l=this.parameters;for(const c in l)l[c]!==void 0&&(t[c]=l[c]);return t}t.data={attributes:{}};const e=this.index;e!==null&&(t.data.index={type:e.array.constructor.name,array:Array.prototype.slice.call(e.array)});const n=this.attributes;for(const l in n){const c=n[l];t.data.attributes[l]=c.toJSON(t.data)}const s={};let r=!1;for(const l in this.morphAttributes){const c=this.morphAttributes[l],f=[];for(let h=0,u=c.length;h<u;h++){const p=c[h];f.push(p.toJSON(t.data))}f.length>0&&(s[l]=f,r=!0)}r&&(t.data.morphAttributes=s,t.data.morphTargetsRelative=this.morphTargetsRelative);const a=this.groups;a.length>0&&(t.data.groups=JSON.parse(JSON.stringify(a)));const o=this.boundingSphere;return o!==null&&(t.data.boundingSphere={center:o.center.toArray(),radius:o.radius}),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const e={};this.name=t.name;const n=t.index;n!==null&&this.setIndex(n.clone(e));const s=t.attributes;for(const c in s){const f=s[c];this.setAttribute(c,f.clone(e))}const r=t.morphAttributes;for(const c in r){const f=[],h=r[c];for(let u=0,p=h.length;u<p;u++)f.push(h[u].clone(e));this.morphAttributes[c]=f}this.morphTargetsRelative=t.morphTargetsRelative;const a=t.groups;for(let c=0,f=a.length;c<f;c++){const h=a[c];this.addGroup(h.start,h.count,h.materialIndex)}const o=t.boundingBox;o!==null&&(this.boundingBox=o.clone());const l=t.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}const Ec=new ue,Hi=new $h,ia=new lr,wc=new F,sa=new F,ra=new F,aa=new F,_o=new F,oa=new F,Tc=new F,la=new F;class Rt extends Oe{constructor(t=new Ge,e=new Xt){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),t.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=t.morphTargetInfluences.slice()),t.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary)),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){const e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){const s=e[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){const o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}getVertexPosition(t,e){const n=this.geometry,s=n.attributes.position,r=n.morphAttributes.position,a=n.morphTargetsRelative;e.fromBufferAttribute(s,t);const o=this.morphTargetInfluences;if(r&&o){oa.set(0,0,0);for(let l=0,c=r.length;l<c;l++){const f=o[l],h=r[l];f!==0&&(_o.fromBufferAttribute(h,t),a?oa.addScaledVector(_o,f):oa.addScaledVector(_o.sub(e),f))}e.add(oa)}return e}raycast(t,e){const n=this.geometry,s=this.material,r=this.matrixWorld;s!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),ia.copy(n.boundingSphere),ia.applyMatrix4(r),Hi.copy(t.ray).recast(t.near),!(ia.containsPoint(Hi.origin)===!1&&(Hi.intersectSphere(ia,wc)===null||Hi.origin.distanceToSquared(wc)>(t.far-t.near)**2))&&(Ec.copy(r).invert(),Hi.copy(t.ray).applyMatrix4(Ec),!(n.boundingBox!==null&&Hi.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(t,e,Hi)))}_computeIntersections(t,e,n){let s;const r=this.geometry,a=this.material,o=r.index,l=r.attributes.position,c=r.attributes.uv,f=r.attributes.uv1,h=r.attributes.normal,u=r.groups,p=r.drawRange;if(o!==null)if(Array.isArray(a))for(let g=0,_=u.length;g<_;g++){const m=u[g],d=a[m.materialIndex],E=Math.max(m.start,p.start),y=Math.min(o.count,Math.min(m.start+m.count,p.start+p.count));for(let S=E,O=y;S<O;S+=3){const T=o.getX(S),R=o.getX(S+1),I=o.getX(S+2);s=ca(this,d,t,n,c,f,h,T,R,I),s&&(s.faceIndex=Math.floor(S/3),s.face.materialIndex=m.materialIndex,e.push(s))}}else{const g=Math.max(0,p.start),_=Math.min(o.count,p.start+p.count);for(let m=g,d=_;m<d;m+=3){const E=o.getX(m),y=o.getX(m+1),S=o.getX(m+2);s=ca(this,a,t,n,c,f,h,E,y,S),s&&(s.faceIndex=Math.floor(m/3),e.push(s))}}else if(l!==void 0)if(Array.isArray(a))for(let g=0,_=u.length;g<_;g++){const m=u[g],d=a[m.materialIndex],E=Math.max(m.start,p.start),y=Math.min(l.count,Math.min(m.start+m.count,p.start+p.count));for(let S=E,O=y;S<O;S+=3){const T=S,R=S+1,I=S+2;s=ca(this,d,t,n,c,f,h,T,R,I),s&&(s.faceIndex=Math.floor(S/3),s.face.materialIndex=m.materialIndex,e.push(s))}}else{const g=Math.max(0,p.start),_=Math.min(l.count,p.start+p.count);for(let m=g,d=_;m<d;m+=3){const E=m,y=m+1,S=m+2;s=ca(this,a,t,n,c,f,h,E,y,S),s&&(s.faceIndex=Math.floor(m/3),e.push(s))}}}}function ju(i,t,e,n,s,r,a,o){let l;if(t.side===vn?l=n.intersectTriangle(a,r,s,!0,o):l=n.intersectTriangle(s,r,a,t.side===Ii,o),l===null)return null;la.copy(o),la.applyMatrix4(i.matrixWorld);const c=e.ray.origin.distanceTo(la);return c<e.near||c>e.far?null:{distance:c,point:la.clone(),object:i}}function ca(i,t,e,n,s,r,a,o,l,c){i.getVertexPosition(o,sa),i.getVertexPosition(l,ra),i.getVertexPosition(c,aa);const f=ju(i,t,e,n,sa,ra,aa,Tc);if(f){const h=new F;Dn.getBarycoord(Tc,sa,ra,aa,h),s&&(f.uv=Dn.getInterpolatedAttribute(s,o,l,c,h,new Yt)),r&&(f.uv1=Dn.getInterpolatedAttribute(r,o,l,c,h,new Yt)),a&&(f.normal=Dn.getInterpolatedAttribute(a,o,l,c,h,new F),f.normal.dot(n.direction)>0&&f.normal.multiplyScalar(-1));const u={a:o,b:l,c,normal:new F,materialIndex:0};Dn.getNormal(sa,ra,aa,u.normal),f.face=u,f.barycoord=h}return f}class Ie extends Ge{constructor(t=1,e=1,n=1,s=1,r=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:e,depth:n,widthSegments:s,heightSegments:r,depthSegments:a};const o=this;s=Math.floor(s),r=Math.floor(r),a=Math.floor(a);const l=[],c=[],f=[],h=[];let u=0,p=0;g("z","y","x",-1,-1,n,e,t,a,r,0),g("z","y","x",1,-1,n,e,-t,a,r,1),g("x","z","y",1,1,t,n,e,s,a,2),g("x","z","y",1,-1,t,n,-e,s,a,3),g("x","y","z",1,-1,t,e,n,s,r,4),g("x","y","z",-1,-1,t,e,-n,s,r,5),this.setIndex(l),this.setAttribute("position",new Ce(c,3)),this.setAttribute("normal",new Ce(f,3)),this.setAttribute("uv",new Ce(h,2));function g(_,m,d,E,y,S,O,T,R,I,b){const M=S/R,A=O/I,V=S/2,z=O/2,C=T/2,W=R+1,G=I+1;let Z=0,H=0;const it=new F;for(let ot=0;ot<G;ot++){const gt=ot*A-z;for(let Ct=0;Ct<W;Ct++){const Jt=Ct*M-V;it[_]=Jt*E,it[m]=gt*y,it[d]=C,c.push(it.x,it.y,it.z),it[_]=0,it[m]=0,it[d]=T>0?1:-1,f.push(it.x,it.y,it.z),h.push(Ct/R),h.push(1-ot/I),Z+=1}}for(let ot=0;ot<I;ot++)for(let gt=0;gt<R;gt++){const Ct=u+gt+W*ot,Jt=u+gt+W*(ot+1),Y=u+(gt+1)+W*(ot+1),tt=u+(gt+1)+W*ot;l.push(Ct,Jt,tt),l.push(Jt,Y,tt),H+=6}o.addGroup(p,H,b),p+=H,u+=Z}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Ie(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}}function ir(i){const t={};for(const e in i){t[e]={};for(const n in i[e]){const s=i[e][n];s&&(s.isColor||s.isMatrix3||s.isMatrix4||s.isVector2||s.isVector3||s.isVector4||s.isTexture||s.isQuaternion)?s.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[e][n]=null):t[e][n]=s.clone():Array.isArray(s)?t[e][n]=s.slice():t[e][n]=s}}return t}function cn(i){const t={};for(let e=0;e<i.length;e++){const n=ir(i[e]);for(const s in n)t[s]=n[s]}return t}function Ju(i){const t=[];for(let e=0;e<i.length;e++)t.push(i[e].clone());return t}function Qh(i){const t=i.getRenderTarget();return t===null?i.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:ae.workingColorSpace}const Qu={clone:ir,merge:cn};var td=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,ed=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class gi extends fs{static get type(){return"ShaderMaterial"}constructor(t){super(),this.isShaderMaterial=!0,this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=td,this.fragmentShader=ed,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,t!==void 0&&this.setValues(t)}copy(t){return super.copy(t),this.fragmentShader=t.fragmentShader,this.vertexShader=t.vertexShader,this.uniforms=ir(t.uniforms),this.uniformsGroups=Ju(t.uniformsGroups),this.defines=Object.assign({},t.defines),this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.fog=t.fog,this.lights=t.lights,this.clipping=t.clipping,this.extensions=Object.assign({},t.extensions),this.glslVersion=t.glslVersion,this}toJSON(t){const e=super.toJSON(t);e.glslVersion=this.glslVersion,e.uniforms={};for(const s in this.uniforms){const a=this.uniforms[s].value;a&&a.isTexture?e.uniforms[s]={type:"t",value:a.toJSON(t).uuid}:a&&a.isColor?e.uniforms[s]={type:"c",value:a.getHex()}:a&&a.isVector2?e.uniforms[s]={type:"v2",value:a.toArray()}:a&&a.isVector3?e.uniforms[s]={type:"v3",value:a.toArray()}:a&&a.isVector4?e.uniforms[s]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?e.uniforms[s]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?e.uniforms[s]={type:"m4",value:a.toArray()}:e.uniforms[s]={value:a}}Object.keys(this.defines).length>0&&(e.defines=this.defines),e.vertexShader=this.vertexShader,e.fragmentShader=this.fragmentShader,e.lights=this.lights,e.clipping=this.clipping;const n={};for(const s in this.extensions)this.extensions[s]===!0&&(n[s]=!0);return Object.keys(n).length>0&&(e.extensions=n),e}}class tf extends Oe{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new ue,this.projectionMatrix=new ue,this.projectionMatrixInverse=new ue,this.coordinateSystem=hi}copy(t,e){return super.copy(t,e),this.matrixWorldInverse.copy(t.matrixWorldInverse),this.projectionMatrix.copy(t.projectionMatrix),this.projectionMatrixInverse.copy(t.projectionMatrixInverse),this.coordinateSystem=t.coordinateSystem,this}getWorldDirection(t){return super.getWorldDirection(t).negate()}updateMatrixWorld(t){super.updateMatrixWorld(t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(t,e){super.updateWorldMatrix(t,e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}}const wi=new F,Ac=new Yt,Rc=new Yt;class zn extends tf{constructor(t=50,e=1,n=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=t,this.zoom=1,this.near=n,this.far=s,this.focus=10,this.aspect=e,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.fov=t.fov,this.zoom=t.zoom,this.near=t.near,this.far=t.far,this.focus=t.focus,this.aspect=t.aspect,this.view=t.view===null?null:Object.assign({},t.view),this.filmGauge=t.filmGauge,this.filmOffset=t.filmOffset,this}setFocalLength(t){const e=.5*this.getFilmHeight()/t;this.fov=zr*2*Math.atan(e),this.updateProjectionMatrix()}getFocalLength(){const t=Math.tan(Fr*.5*this.fov);return .5*this.getFilmHeight()/t}getEffectiveFOV(){return zr*2*Math.atan(Math.tan(Fr*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(t,e,n){wi.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),e.set(wi.x,wi.y).multiplyScalar(-t/wi.z),wi.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(wi.x,wi.y).multiplyScalar(-t/wi.z)}getViewSize(t,e){return this.getViewBounds(t,Ac,Rc),e.subVectors(Rc,Ac)}setViewOffset(t,e,n,s,r,a){this.aspect=t/e,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=this.near;let e=t*Math.tan(Fr*.5*this.fov)/this.zoom,n=2*e,s=this.aspect*n,r=-.5*s;const a=this.view;if(this.view!==null&&this.view.enabled){const l=a.fullWidth,c=a.fullHeight;r+=a.offsetX*s/l,e-=a.offsetY*n/c,s*=a.width/l,n*=a.height/c}const o=this.filmOffset;o!==0&&(r+=t*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+s,e,e-n,t,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const e=super.toJSON(t);return e.object.fov=this.fov,e.object.zoom=this.zoom,e.object.near=this.near,e.object.far=this.far,e.object.focus=this.focus,e.object.aspect=this.aspect,this.view!==null&&(e.object.view=Object.assign({},this.view)),e.object.filmGauge=this.filmGauge,e.object.filmOffset=this.filmOffset,e}}const ws=-90,Ts=1;class nd extends Oe{constructor(t,e,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;const s=new zn(ws,Ts,t,e);s.layers=this.layers,this.add(s);const r=new zn(ws,Ts,t,e);r.layers=this.layers,this.add(r);const a=new zn(ws,Ts,t,e);a.layers=this.layers,this.add(a);const o=new zn(ws,Ts,t,e);o.layers=this.layers,this.add(o);const l=new zn(ws,Ts,t,e);l.layers=this.layers,this.add(l);const c=new zn(ws,Ts,t,e);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){const t=this.coordinateSystem,e=this.children.concat(),[n,s,r,a,o,l]=e;for(const c of e)this.remove(c);if(t===hi)n.up.set(0,1,0),n.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(t===Oa)n.up.set(0,-1,0),n.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+t);for(const c of e)this.add(c),c.updateMatrixWorld()}update(t,e){this.parent===null&&this.updateMatrixWorld();const{renderTarget:n,activeMipmapLevel:s}=this;this.coordinateSystem!==t.coordinateSystem&&(this.coordinateSystem=t.coordinateSystem,this.updateCoordinateSystem());const[r,a,o,l,c,f]=this.children,h=t.getRenderTarget(),u=t.getActiveCubeFace(),p=t.getActiveMipmapLevel(),g=t.xr.enabled;t.xr.enabled=!1;const _=n.texture.generateMipmaps;n.texture.generateMipmaps=!1,t.setRenderTarget(n,0,s),t.render(e,r),t.setRenderTarget(n,1,s),t.render(e,a),t.setRenderTarget(n,2,s),t.render(e,o),t.setRenderTarget(n,3,s),t.render(e,l),t.setRenderTarget(n,4,s),t.render(e,c),n.texture.generateMipmaps=_,t.setRenderTarget(n,5,s),t.render(e,f),t.setRenderTarget(h,u,p),t.xr.enabled=g,n.texture.needsPMREMUpdate=!0}}class ef extends tn{constructor(t,e,n,s,r,a,o,l,c,f){t=t!==void 0?t:[],e=e!==void 0?e:Qs,super(t,e,n,s,r,a,o,l,c,f),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(t){this.image=t}}class id extends Ui{constructor(t=1,e={}){super(t,t,e),this.isWebGLCubeRenderTarget=!0;const n={width:t,height:t,depth:1},s=[n,n,n,n,n,n];this.texture=new ef(s,e.mapping,e.wrapS,e.wrapT,e.magFilter,e.minFilter,e.format,e.type,e.anisotropy,e.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.generateMipmaps=e.generateMipmaps!==void 0?e.generateMipmaps:!1,this.texture.minFilter=e.minFilter!==void 0?e.minFilter:Yn}fromEquirectangularTexture(t,e){this.texture.type=e.type,this.texture.colorSpace=e.colorSpace,this.texture.generateMipmaps=e.generateMipmaps,this.texture.minFilter=e.minFilter,this.texture.magFilter=e.magFilter;const n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},s=new Ie(5,5,5),r=new gi({name:"CubemapFromEquirect",uniforms:ir(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:vn,blending:Di});r.uniforms.tEquirect.value=e;const a=new Rt(s,r),o=e.minFilter;return e.minFilter===Pi&&(e.minFilter=Yn),new nd(1,10,this).update(t,a),e.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(t,e,n,s){const r=t.getRenderTarget();for(let a=0;a<6;a++)t.setRenderTarget(this,a),t.clear(e,n,s);t.setRenderTarget(r)}}const xo=new F,sd=new F,rd=new Ht;class $i{constructor(t=new F(1,0,0),e=0){this.isPlane=!0,this.normal=t,this.constant=e}set(t,e){return this.normal.copy(t),this.constant=e,this}setComponents(t,e,n,s){return this.normal.set(t,e,n),this.constant=s,this}setFromNormalAndCoplanarPoint(t,e){return this.normal.copy(t),this.constant=-e.dot(this.normal),this}setFromCoplanarPoints(t,e,n){const s=xo.subVectors(n,e).cross(sd.subVectors(t,e)).normalize();return this.setFromNormalAndCoplanarPoint(s,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){const t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,e){return e.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,e){const n=t.delta(xo),s=this.normal.dot(n);if(s===0)return this.distanceToPoint(t.start)===0?e.copy(t.start):null;const r=-(t.start.dot(this.normal)+this.constant)/s;return r<0||r>1?null:e.copy(t.start).addScaledVector(n,r)}intersectsLine(t){const e=this.distanceToPoint(t.start),n=this.distanceToPoint(t.end);return e<0&&n>0||n<0&&e>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,e){const n=e||rd.getNormalMatrix(t),s=this.coplanarPoint(xo).applyMatrix4(t),r=this.normal.applyMatrix3(n).normalize();return this.constant=-s.dot(r),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}}const Gi=new lr,ha=new F;class Yl{constructor(t=new $i,e=new $i,n=new $i,s=new $i,r=new $i,a=new $i){this.planes=[t,e,n,s,r,a]}set(t,e,n,s,r,a){const o=this.planes;return o[0].copy(t),o[1].copy(e),o[2].copy(n),o[3].copy(s),o[4].copy(r),o[5].copy(a),this}copy(t){const e=this.planes;for(let n=0;n<6;n++)e[n].copy(t.planes[n]);return this}setFromProjectionMatrix(t,e=hi){const n=this.planes,s=t.elements,r=s[0],a=s[1],o=s[2],l=s[3],c=s[4],f=s[5],h=s[6],u=s[7],p=s[8],g=s[9],_=s[10],m=s[11],d=s[12],E=s[13],y=s[14],S=s[15];if(n[0].setComponents(l-r,u-c,m-p,S-d).normalize(),n[1].setComponents(l+r,u+c,m+p,S+d).normalize(),n[2].setComponents(l+a,u+f,m+g,S+E).normalize(),n[3].setComponents(l-a,u-f,m-g,S-E).normalize(),n[4].setComponents(l-o,u-h,m-_,S-y).normalize(),e===hi)n[5].setComponents(l+o,u+h,m+_,S+y).normalize();else if(e===Oa)n[5].setComponents(o,h,_,y).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+e);return this}intersectsObject(t){if(t.boundingSphere!==void 0)t.boundingSphere===null&&t.computeBoundingSphere(),Gi.copy(t.boundingSphere).applyMatrix4(t.matrixWorld);else{const e=t.geometry;e.boundingSphere===null&&e.computeBoundingSphere(),Gi.copy(e.boundingSphere).applyMatrix4(t.matrixWorld)}return this.intersectsSphere(Gi)}intersectsSprite(t){return Gi.center.set(0,0,0),Gi.radius=.7071067811865476,Gi.applyMatrix4(t.matrixWorld),this.intersectsSphere(Gi)}intersectsSphere(t){const e=this.planes,n=t.center,s=-t.radius;for(let r=0;r<6;r++)if(e[r].distanceToPoint(n)<s)return!1;return!0}intersectsBox(t){const e=this.planes;for(let n=0;n<6;n++){const s=e[n];if(ha.x=s.normal.x>0?t.max.x:t.min.x,ha.y=s.normal.y>0?t.max.y:t.min.y,ha.z=s.normal.z>0?t.max.z:t.min.z,s.distanceToPoint(ha)<0)return!1}return!0}containsPoint(t){const e=this.planes;for(let n=0;n<6;n++)if(e[n].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}function nf(){let i=null,t=!1,e=null,n=null;function s(r,a){e(r,a),n=i.requestAnimationFrame(s)}return{start:function(){t!==!0&&e!==null&&(n=i.requestAnimationFrame(s),t=!0)},stop:function(){i.cancelAnimationFrame(n),t=!1},setAnimationLoop:function(r){e=r},setContext:function(r){i=r}}}function ad(i){const t=new WeakMap;function e(o,l){const c=o.array,f=o.usage,h=c.byteLength,u=i.createBuffer();i.bindBuffer(l,u),i.bufferData(l,c,f),o.onUploadCallback();let p;if(c instanceof Float32Array)p=i.FLOAT;else if(c instanceof Uint16Array)o.isFloat16BufferAttribute?p=i.HALF_FLOAT:p=i.UNSIGNED_SHORT;else if(c instanceof Int16Array)p=i.SHORT;else if(c instanceof Uint32Array)p=i.UNSIGNED_INT;else if(c instanceof Int32Array)p=i.INT;else if(c instanceof Int8Array)p=i.BYTE;else if(c instanceof Uint8Array)p=i.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)p=i.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:u,type:p,bytesPerElement:c.BYTES_PER_ELEMENT,version:o.version,size:h}}function n(o,l,c){const f=l.array,h=l.updateRanges;if(i.bindBuffer(c,o),h.length===0)i.bufferSubData(c,0,f);else{h.sort((p,g)=>p.start-g.start);let u=0;for(let p=1;p<h.length;p++){const g=h[u],_=h[p];_.start<=g.start+g.count+1?g.count=Math.max(g.count,_.start+_.count-g.start):(++u,h[u]=_)}h.length=u+1;for(let p=0,g=h.length;p<g;p++){const _=h[p];i.bufferSubData(c,_.start*f.BYTES_PER_ELEMENT,f,_.start,_.count)}l.clearUpdateRanges()}l.onUploadCallback()}function s(o){return o.isInterleavedBufferAttribute&&(o=o.data),t.get(o)}function r(o){o.isInterleavedBufferAttribute&&(o=o.data);const l=t.get(o);l&&(i.deleteBuffer(l.buffer),t.delete(o))}function a(o,l){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){const f=t.get(o);(!f||f.version<o.version)&&t.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}const c=t.get(o);if(c===void 0)t.set(o,e(o,l));else if(c.version<o.version){if(c.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(c.buffer,o,l),c.version=o.version}}return{get:s,remove:r,update:a}}class Te extends Ge{constructor(t=1,e=1,n=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:e,widthSegments:n,heightSegments:s};const r=t/2,a=e/2,o=Math.floor(n),l=Math.floor(s),c=o+1,f=l+1,h=t/o,u=e/l,p=[],g=[],_=[],m=[];for(let d=0;d<f;d++){const E=d*u-a;for(let y=0;y<c;y++){const S=y*h-r;g.push(S,-E,0),_.push(0,0,1),m.push(y/o),m.push(1-d/l)}}for(let d=0;d<l;d++)for(let E=0;E<o;E++){const y=E+c*d,S=E+c*(d+1),O=E+1+c*(d+1),T=E+1+c*d;p.push(y,S,T),p.push(S,O,T)}this.setIndex(p),this.setAttribute("position",new Ce(g,3)),this.setAttribute("normal",new Ce(_,3)),this.setAttribute("uv",new Ce(m,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Te(t.width,t.height,t.widthSegments,t.heightSegments)}}var od=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,ld=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,cd=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,hd=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,fd=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,ud=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,dd=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,pd=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,md=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec3 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 ).rgb;
	}
#endif`,gd=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,_d=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,xd=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,vd=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,Md=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,Sd=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,yd=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,bd=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Ed=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,wd=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Td=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,Ad=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,Rd=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`,Cd=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif
#ifdef USE_BATCHING_COLOR
	vec3 batchingColor = getBatchingColor( getIndirectIndex( gl_DrawID ) );
	vColor.xyz *= batchingColor.xyz;
#endif`,Pd=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,Ld=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,Dd=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,Id=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Ud=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Nd=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Fd=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Od="gl_FragColor = linearToOutputTexel( gl_FragColor );",Bd=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,zd=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,kd=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,Hd=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,Gd=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,Vd=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,Wd=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Xd=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,Yd=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,qd=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Zd=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,Kd=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,$d=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,jd=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,Jd=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,Qd=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,t0=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,e0=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,n0=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,i0=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,s0=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,r0=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,a0=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,o0=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,l0=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,c0=`#if defined( USE_LOGDEPTHBUF )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,h0=`#if defined( USE_LOGDEPTHBUF )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,f0=`#ifdef USE_LOGDEPTHBUF
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,u0=`#ifdef USE_LOGDEPTHBUF
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,d0=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,p0=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,m0=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,g0=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,_0=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,x0=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,v0=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,M0=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,S0=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,y0=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,b0=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,E0=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,w0=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,T0=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,A0=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,R0=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,C0=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,P0=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,L0=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,D0=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,I0=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,U0=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,N0=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,F0=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,O0=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,B0=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,z0=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,k0=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,H0=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,G0=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		float hard_shadow = step( compare , distribution.x );
		if (hard_shadow != 1.0 ) {
			float distance = compare - distribution.x ;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		
		float lightToPositionLength = length( lightToPosition );
		if ( lightToPositionLength - shadowCameraFar <= 0.0 && lightToPositionLength - shadowCameraNear >= 0.0 ) {
			float dp = ( lightToPositionLength - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
			#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
				vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
				shadow = (
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
				) * ( 1.0 / 9.0 );
			#else
				shadow = texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
			#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
#endif`,V0=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,W0=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,X0=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,Y0=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,q0=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,Z0=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,K0=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,$0=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,j0=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,J0=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,Q0=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,tp=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,ep=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
		
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
		
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		
		#else
		
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,np=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,ip=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,sp=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,rp=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const ap=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,op=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,lp=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,cp=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,hp=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,fp=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,up=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,dp=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,pp=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,mp=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,gp=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,_p=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,xp=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,vp=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Mp=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,Sp=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,yp=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,bp=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Ep=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,wp=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Tp=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,Ap=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,Rp=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Cp=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Pp=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,Lp=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Dp=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Ip=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Up=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,Np=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Fp=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Op=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Bp=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,zp=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Wt={alphahash_fragment:od,alphahash_pars_fragment:ld,alphamap_fragment:cd,alphamap_pars_fragment:hd,alphatest_fragment:fd,alphatest_pars_fragment:ud,aomap_fragment:dd,aomap_pars_fragment:pd,batching_pars_vertex:md,batching_vertex:gd,begin_vertex:_d,beginnormal_vertex:xd,bsdfs:vd,iridescence_fragment:Md,bumpmap_pars_fragment:Sd,clipping_planes_fragment:yd,clipping_planes_pars_fragment:bd,clipping_planes_pars_vertex:Ed,clipping_planes_vertex:wd,color_fragment:Td,color_pars_fragment:Ad,color_pars_vertex:Rd,color_vertex:Cd,common:Pd,cube_uv_reflection_fragment:Ld,defaultnormal_vertex:Dd,displacementmap_pars_vertex:Id,displacementmap_vertex:Ud,emissivemap_fragment:Nd,emissivemap_pars_fragment:Fd,colorspace_fragment:Od,colorspace_pars_fragment:Bd,envmap_fragment:zd,envmap_common_pars_fragment:kd,envmap_pars_fragment:Hd,envmap_pars_vertex:Gd,envmap_physical_pars_fragment:Qd,envmap_vertex:Vd,fog_vertex:Wd,fog_pars_vertex:Xd,fog_fragment:Yd,fog_pars_fragment:qd,gradientmap_pars_fragment:Zd,lightmap_pars_fragment:Kd,lights_lambert_fragment:$d,lights_lambert_pars_fragment:jd,lights_pars_begin:Jd,lights_toon_fragment:t0,lights_toon_pars_fragment:e0,lights_phong_fragment:n0,lights_phong_pars_fragment:i0,lights_physical_fragment:s0,lights_physical_pars_fragment:r0,lights_fragment_begin:a0,lights_fragment_maps:o0,lights_fragment_end:l0,logdepthbuf_fragment:c0,logdepthbuf_pars_fragment:h0,logdepthbuf_pars_vertex:f0,logdepthbuf_vertex:u0,map_fragment:d0,map_pars_fragment:p0,map_particle_fragment:m0,map_particle_pars_fragment:g0,metalnessmap_fragment:_0,metalnessmap_pars_fragment:x0,morphinstance_vertex:v0,morphcolor_vertex:M0,morphnormal_vertex:S0,morphtarget_pars_vertex:y0,morphtarget_vertex:b0,normal_fragment_begin:E0,normal_fragment_maps:w0,normal_pars_fragment:T0,normal_pars_vertex:A0,normal_vertex:R0,normalmap_pars_fragment:C0,clearcoat_normal_fragment_begin:P0,clearcoat_normal_fragment_maps:L0,clearcoat_pars_fragment:D0,iridescence_pars_fragment:I0,opaque_fragment:U0,packing:N0,premultiplied_alpha_fragment:F0,project_vertex:O0,dithering_fragment:B0,dithering_pars_fragment:z0,roughnessmap_fragment:k0,roughnessmap_pars_fragment:H0,shadowmap_pars_fragment:G0,shadowmap_pars_vertex:V0,shadowmap_vertex:W0,shadowmask_pars_fragment:X0,skinbase_vertex:Y0,skinning_pars_vertex:q0,skinning_vertex:Z0,skinnormal_vertex:K0,specularmap_fragment:$0,specularmap_pars_fragment:j0,tonemapping_fragment:J0,tonemapping_pars_fragment:Q0,transmission_fragment:tp,transmission_pars_fragment:ep,uv_pars_fragment:np,uv_pars_vertex:ip,uv_vertex:sp,worldpos_vertex:rp,background_vert:ap,background_frag:op,backgroundCube_vert:lp,backgroundCube_frag:cp,cube_vert:hp,cube_frag:fp,depth_vert:up,depth_frag:dp,distanceRGBA_vert:pp,distanceRGBA_frag:mp,equirect_vert:gp,equirect_frag:_p,linedashed_vert:xp,linedashed_frag:vp,meshbasic_vert:Mp,meshbasic_frag:Sp,meshlambert_vert:yp,meshlambert_frag:bp,meshmatcap_vert:Ep,meshmatcap_frag:wp,meshnormal_vert:Tp,meshnormal_frag:Ap,meshphong_vert:Rp,meshphong_frag:Cp,meshphysical_vert:Pp,meshphysical_frag:Lp,meshtoon_vert:Dp,meshtoon_frag:Ip,points_vert:Up,points_frag:Np,shadow_vert:Fp,shadow_frag:Op,sprite_vert:Bp,sprite_frag:zp},ct={common:{diffuse:{value:new Tt(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Ht},alphaMap:{value:null},alphaMapTransform:{value:new Ht},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Ht}},envmap:{envMap:{value:null},envMapRotation:{value:new Ht},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Ht}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Ht}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Ht},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Ht},normalScale:{value:new Yt(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Ht},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Ht}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Ht}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Ht}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Tt(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new Tt(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Ht},alphaTest:{value:0},uvTransform:{value:new Ht}},sprite:{diffuse:{value:new Tt(16777215)},opacity:{value:1},center:{value:new Yt(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Ht},alphaMap:{value:null},alphaMapTransform:{value:new Ht},alphaTest:{value:0}}},Xn={basic:{uniforms:cn([ct.common,ct.specularmap,ct.envmap,ct.aomap,ct.lightmap,ct.fog]),vertexShader:Wt.meshbasic_vert,fragmentShader:Wt.meshbasic_frag},lambert:{uniforms:cn([ct.common,ct.specularmap,ct.envmap,ct.aomap,ct.lightmap,ct.emissivemap,ct.bumpmap,ct.normalmap,ct.displacementmap,ct.fog,ct.lights,{emissive:{value:new Tt(0)}}]),vertexShader:Wt.meshlambert_vert,fragmentShader:Wt.meshlambert_frag},phong:{uniforms:cn([ct.common,ct.specularmap,ct.envmap,ct.aomap,ct.lightmap,ct.emissivemap,ct.bumpmap,ct.normalmap,ct.displacementmap,ct.fog,ct.lights,{emissive:{value:new Tt(0)},specular:{value:new Tt(1118481)},shininess:{value:30}}]),vertexShader:Wt.meshphong_vert,fragmentShader:Wt.meshphong_frag},standard:{uniforms:cn([ct.common,ct.envmap,ct.aomap,ct.lightmap,ct.emissivemap,ct.bumpmap,ct.normalmap,ct.displacementmap,ct.roughnessmap,ct.metalnessmap,ct.fog,ct.lights,{emissive:{value:new Tt(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Wt.meshphysical_vert,fragmentShader:Wt.meshphysical_frag},toon:{uniforms:cn([ct.common,ct.aomap,ct.lightmap,ct.emissivemap,ct.bumpmap,ct.normalmap,ct.displacementmap,ct.gradientmap,ct.fog,ct.lights,{emissive:{value:new Tt(0)}}]),vertexShader:Wt.meshtoon_vert,fragmentShader:Wt.meshtoon_frag},matcap:{uniforms:cn([ct.common,ct.bumpmap,ct.normalmap,ct.displacementmap,ct.fog,{matcap:{value:null}}]),vertexShader:Wt.meshmatcap_vert,fragmentShader:Wt.meshmatcap_frag},points:{uniforms:cn([ct.points,ct.fog]),vertexShader:Wt.points_vert,fragmentShader:Wt.points_frag},dashed:{uniforms:cn([ct.common,ct.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Wt.linedashed_vert,fragmentShader:Wt.linedashed_frag},depth:{uniforms:cn([ct.common,ct.displacementmap]),vertexShader:Wt.depth_vert,fragmentShader:Wt.depth_frag},normal:{uniforms:cn([ct.common,ct.bumpmap,ct.normalmap,ct.displacementmap,{opacity:{value:1}}]),vertexShader:Wt.meshnormal_vert,fragmentShader:Wt.meshnormal_frag},sprite:{uniforms:cn([ct.sprite,ct.fog]),vertexShader:Wt.sprite_vert,fragmentShader:Wt.sprite_frag},background:{uniforms:{uvTransform:{value:new Ht},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Wt.background_vert,fragmentShader:Wt.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Ht}},vertexShader:Wt.backgroundCube_vert,fragmentShader:Wt.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Wt.cube_vert,fragmentShader:Wt.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Wt.equirect_vert,fragmentShader:Wt.equirect_frag},distanceRGBA:{uniforms:cn([ct.common,ct.displacementmap,{referencePosition:{value:new F},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Wt.distanceRGBA_vert,fragmentShader:Wt.distanceRGBA_frag},shadow:{uniforms:cn([ct.lights,ct.fog,{color:{value:new Tt(0)},opacity:{value:1}}]),vertexShader:Wt.shadow_vert,fragmentShader:Wt.shadow_frag}};Xn.physical={uniforms:cn([Xn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Ht},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Ht},clearcoatNormalScale:{value:new Yt(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Ht},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Ht},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Ht},sheen:{value:0},sheenColor:{value:new Tt(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Ht},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Ht},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Ht},transmissionSamplerSize:{value:new Yt},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Ht},attenuationDistance:{value:0},attenuationColor:{value:new Tt(0)},specularColor:{value:new Tt(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Ht},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Ht},anisotropyVector:{value:new Yt},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Ht}}]),vertexShader:Wt.meshphysical_vert,fragmentShader:Wt.meshphysical_frag};const fa={r:0,b:0,g:0},Vi=new In,kp=new ue;function Hp(i,t,e,n,s,r,a){const o=new Tt(0);let l=r===!0?0:1,c,f,h=null,u=0,p=null;function g(E){let y=E.isScene===!0?E.background:null;return y&&y.isTexture&&(y=(E.backgroundBlurriness>0?e:t).get(y)),y}function _(E){let y=!1;const S=g(E);S===null?d(o,l):S&&S.isColor&&(d(S,1),y=!0);const O=i.xr.getEnvironmentBlendMode();O==="additive"?n.buffers.color.setClear(0,0,0,1,a):O==="alpha-blend"&&n.buffers.color.setClear(0,0,0,0,a),(i.autoClear||y)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),i.clear(i.autoClearColor,i.autoClearDepth,i.autoClearStencil))}function m(E,y){const S=g(y);S&&(S.isCubeTexture||S.mapping===Va)?(f===void 0&&(f=new Rt(new Ie(1,1,1),new gi({name:"BackgroundCubeMaterial",uniforms:ir(Xn.backgroundCube.uniforms),vertexShader:Xn.backgroundCube.vertexShader,fragmentShader:Xn.backgroundCube.fragmentShader,side:vn,depthTest:!1,depthWrite:!1,fog:!1})),f.geometry.deleteAttribute("normal"),f.geometry.deleteAttribute("uv"),f.onBeforeRender=function(O,T,R){this.matrixWorld.copyPosition(R.matrixWorld)},Object.defineProperty(f.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),s.update(f)),Vi.copy(y.backgroundRotation),Vi.x*=-1,Vi.y*=-1,Vi.z*=-1,S.isCubeTexture&&S.isRenderTargetTexture===!1&&(Vi.y*=-1,Vi.z*=-1),f.material.uniforms.envMap.value=S,f.material.uniforms.flipEnvMap.value=S.isCubeTexture&&S.isRenderTargetTexture===!1?-1:1,f.material.uniforms.backgroundBlurriness.value=y.backgroundBlurriness,f.material.uniforms.backgroundIntensity.value=y.backgroundIntensity,f.material.uniforms.backgroundRotation.value.setFromMatrix4(kp.makeRotationFromEuler(Vi)),f.material.toneMapped=ae.getTransfer(S.colorSpace)!==ge,(h!==S||u!==S.version||p!==i.toneMapping)&&(f.material.needsUpdate=!0,h=S,u=S.version,p=i.toneMapping),f.layers.enableAll(),E.unshift(f,f.geometry,f.material,0,0,null)):S&&S.isTexture&&(c===void 0&&(c=new Rt(new Te(2,2),new gi({name:"BackgroundMaterial",uniforms:ir(Xn.background.uniforms),vertexShader:Xn.background.vertexShader,fragmentShader:Xn.background.fragmentShader,side:Ii,depthTest:!1,depthWrite:!1,fog:!1})),c.geometry.deleteAttribute("normal"),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),s.update(c)),c.material.uniforms.t2D.value=S,c.material.uniforms.backgroundIntensity.value=y.backgroundIntensity,c.material.toneMapped=ae.getTransfer(S.colorSpace)!==ge,S.matrixAutoUpdate===!0&&S.updateMatrix(),c.material.uniforms.uvTransform.value.copy(S.matrix),(h!==S||u!==S.version||p!==i.toneMapping)&&(c.material.needsUpdate=!0,h=S,u=S.version,p=i.toneMapping),c.layers.enableAll(),E.unshift(c,c.geometry,c.material,0,0,null))}function d(E,y){E.getRGB(fa,Qh(i)),n.buffers.color.setClear(fa.r,fa.g,fa.b,y,a)}return{getClearColor:function(){return o},setClearColor:function(E,y=1){o.set(E),l=y,d(o,l)},getClearAlpha:function(){return l},setClearAlpha:function(E){l=E,d(o,l)},render:_,addToRenderList:m}}function Gp(i,t){const e=i.getParameter(i.MAX_VERTEX_ATTRIBS),n={},s=u(null);let r=s,a=!1;function o(M,A,V,z,C){let W=!1;const G=h(z,V,A);r!==G&&(r=G,c(r.object)),W=p(M,z,V,C),W&&g(M,z,V,C),C!==null&&t.update(C,i.ELEMENT_ARRAY_BUFFER),(W||a)&&(a=!1,S(M,A,V,z),C!==null&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,t.get(C).buffer))}function l(){return i.createVertexArray()}function c(M){return i.bindVertexArray(M)}function f(M){return i.deleteVertexArray(M)}function h(M,A,V){const z=V.wireframe===!0;let C=n[M.id];C===void 0&&(C={},n[M.id]=C);let W=C[A.id];W===void 0&&(W={},C[A.id]=W);let G=W[z];return G===void 0&&(G=u(l()),W[z]=G),G}function u(M){const A=[],V=[],z=[];for(let C=0;C<e;C++)A[C]=0,V[C]=0,z[C]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:A,enabledAttributes:V,attributeDivisors:z,object:M,attributes:{},index:null}}function p(M,A,V,z){const C=r.attributes,W=A.attributes;let G=0;const Z=V.getAttributes();for(const H in Z)if(Z[H].location>=0){const ot=C[H];let gt=W[H];if(gt===void 0&&(H==="instanceMatrix"&&M.instanceMatrix&&(gt=M.instanceMatrix),H==="instanceColor"&&M.instanceColor&&(gt=M.instanceColor)),ot===void 0||ot.attribute!==gt||gt&&ot.data!==gt.data)return!0;G++}return r.attributesNum!==G||r.index!==z}function g(M,A,V,z){const C={},W=A.attributes;let G=0;const Z=V.getAttributes();for(const H in Z)if(Z[H].location>=0){let ot=W[H];ot===void 0&&(H==="instanceMatrix"&&M.instanceMatrix&&(ot=M.instanceMatrix),H==="instanceColor"&&M.instanceColor&&(ot=M.instanceColor));const gt={};gt.attribute=ot,ot&&ot.data&&(gt.data=ot.data),C[H]=gt,G++}r.attributes=C,r.attributesNum=G,r.index=z}function _(){const M=r.newAttributes;for(let A=0,V=M.length;A<V;A++)M[A]=0}function m(M){d(M,0)}function d(M,A){const V=r.newAttributes,z=r.enabledAttributes,C=r.attributeDivisors;V[M]=1,z[M]===0&&(i.enableVertexAttribArray(M),z[M]=1),C[M]!==A&&(i.vertexAttribDivisor(M,A),C[M]=A)}function E(){const M=r.newAttributes,A=r.enabledAttributes;for(let V=0,z=A.length;V<z;V++)A[V]!==M[V]&&(i.disableVertexAttribArray(V),A[V]=0)}function y(M,A,V,z,C,W,G){G===!0?i.vertexAttribIPointer(M,A,V,C,W):i.vertexAttribPointer(M,A,V,z,C,W)}function S(M,A,V,z){_();const C=z.attributes,W=V.getAttributes(),G=A.defaultAttributeValues;for(const Z in W){const H=W[Z];if(H.location>=0){let it=C[Z];if(it===void 0&&(Z==="instanceMatrix"&&M.instanceMatrix&&(it=M.instanceMatrix),Z==="instanceColor"&&M.instanceColor&&(it=M.instanceColor)),it!==void 0){const ot=it.normalized,gt=it.itemSize,Ct=t.get(it);if(Ct===void 0)continue;const Jt=Ct.buffer,Y=Ct.type,tt=Ct.bytesPerElement,_t=Y===i.INT||Y===i.UNSIGNED_INT||it.gpuType===Fl;if(it.isInterleavedBufferAttribute){const st=it.data,Lt=st.stride,It=it.offset;if(st.isInstancedInterleavedBuffer){for(let zt=0;zt<H.locationSize;zt++)d(H.location+zt,st.meshPerAttribute);M.isInstancedMesh!==!0&&z._maxInstanceCount===void 0&&(z._maxInstanceCount=st.meshPerAttribute*st.count)}else for(let zt=0;zt<H.locationSize;zt++)m(H.location+zt);i.bindBuffer(i.ARRAY_BUFFER,Jt);for(let zt=0;zt<H.locationSize;zt++)y(H.location+zt,gt/H.locationSize,Y,ot,Lt*tt,(It+gt/H.locationSize*zt)*tt,_t)}else{if(it.isInstancedBufferAttribute){for(let st=0;st<H.locationSize;st++)d(H.location+st,it.meshPerAttribute);M.isInstancedMesh!==!0&&z._maxInstanceCount===void 0&&(z._maxInstanceCount=it.meshPerAttribute*it.count)}else for(let st=0;st<H.locationSize;st++)m(H.location+st);i.bindBuffer(i.ARRAY_BUFFER,Jt);for(let st=0;st<H.locationSize;st++)y(H.location+st,gt/H.locationSize,Y,ot,gt*tt,gt/H.locationSize*st*tt,_t)}}else if(G!==void 0){const ot=G[Z];if(ot!==void 0)switch(ot.length){case 2:i.vertexAttrib2fv(H.location,ot);break;case 3:i.vertexAttrib3fv(H.location,ot);break;case 4:i.vertexAttrib4fv(H.location,ot);break;default:i.vertexAttrib1fv(H.location,ot)}}}}E()}function O(){I();for(const M in n){const A=n[M];for(const V in A){const z=A[V];for(const C in z)f(z[C].object),delete z[C];delete A[V]}delete n[M]}}function T(M){if(n[M.id]===void 0)return;const A=n[M.id];for(const V in A){const z=A[V];for(const C in z)f(z[C].object),delete z[C];delete A[V]}delete n[M.id]}function R(M){for(const A in n){const V=n[A];if(V[M.id]===void 0)continue;const z=V[M.id];for(const C in z)f(z[C].object),delete z[C];delete V[M.id]}}function I(){b(),a=!0,r!==s&&(r=s,c(r.object))}function b(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:o,reset:I,resetDefaultState:b,dispose:O,releaseStatesOfGeometry:T,releaseStatesOfProgram:R,initAttributes:_,enableAttribute:m,disableUnusedAttributes:E}}function Vp(i,t,e){let n;function s(c){n=c}function r(c,f){i.drawArrays(n,c,f),e.update(f,n,1)}function a(c,f,h){h!==0&&(i.drawArraysInstanced(n,c,f,h),e.update(f,n,h))}function o(c,f,h){if(h===0)return;t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,c,0,f,0,h);let p=0;for(let g=0;g<h;g++)p+=f[g];e.update(p,n,1)}function l(c,f,h,u){if(h===0)return;const p=t.get("WEBGL_multi_draw");if(p===null)for(let g=0;g<c.length;g++)a(c[g],f[g],u[g]);else{p.multiDrawArraysInstancedWEBGL(n,c,0,f,0,u,0,h);let g=0;for(let _=0;_<h;_++)g+=f[_]*u[_];e.update(g,n,1)}}this.setMode=s,this.render=r,this.renderInstances=a,this.renderMultiDraw=o,this.renderMultiDrawInstances=l}function Wp(i,t,e,n){let s;function r(){if(s!==void 0)return s;if(t.has("EXT_texture_filter_anisotropic")===!0){const R=t.get("EXT_texture_filter_anisotropic");s=i.getParameter(R.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function a(R){return!(R!==Hn&&n.convert(R)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(R){const I=R===ar&&(t.has("EXT_color_buffer_half_float")||t.has("EXT_color_buffer_float"));return!(R!==jn&&n.convert(R)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_TYPE)&&R!==qn&&!I)}function l(R){if(R==="highp"){if(i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.HIGH_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.HIGH_FLOAT).precision>0)return"highp";R="mediump"}return R==="mediump"&&i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.MEDIUM_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=e.precision!==void 0?e.precision:"highp";const f=l(c);f!==c&&(console.warn("THREE.WebGLRenderer:",c,"not supported, using",f,"instead."),c=f);const h=e.logarithmicDepthBuffer===!0,u=e.reverseDepthBuffer===!0&&t.has("EXT_clip_control"),p=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),g=i.getParameter(i.MAX_VERTEX_TEXTURE_IMAGE_UNITS),_=i.getParameter(i.MAX_TEXTURE_SIZE),m=i.getParameter(i.MAX_CUBE_MAP_TEXTURE_SIZE),d=i.getParameter(i.MAX_VERTEX_ATTRIBS),E=i.getParameter(i.MAX_VERTEX_UNIFORM_VECTORS),y=i.getParameter(i.MAX_VARYING_VECTORS),S=i.getParameter(i.MAX_FRAGMENT_UNIFORM_VECTORS),O=g>0,T=i.getParameter(i.MAX_SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:a,textureTypeReadable:o,precision:c,logarithmicDepthBuffer:h,reverseDepthBuffer:u,maxTextures:p,maxVertexTextures:g,maxTextureSize:_,maxCubemapSize:m,maxAttributes:d,maxVertexUniforms:E,maxVaryings:y,maxFragmentUniforms:S,vertexTextures:O,maxSamples:T}}function Xp(i){const t=this;let e=null,n=0,s=!1,r=!1;const a=new $i,o=new Ht,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(h,u){const p=h.length!==0||u||n!==0||s;return s=u,n=h.length,p},this.beginShadows=function(){r=!0,f(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(h,u){e=f(h,u,0)},this.setState=function(h,u,p){const g=h.clippingPlanes,_=h.clipIntersection,m=h.clipShadows,d=i.get(h);if(!s||g===null||g.length===0||r&&!m)r?f(null):c();else{const E=r?0:n,y=E*4;let S=d.clippingState||null;l.value=S,S=f(g,u,y,p);for(let O=0;O!==y;++O)S[O]=e[O];d.clippingState=S,this.numIntersection=_?this.numPlanes:0,this.numPlanes+=E}};function c(){l.value!==e&&(l.value=e,l.needsUpdate=n>0),t.numPlanes=n,t.numIntersection=0}function f(h,u,p,g){const _=h!==null?h.length:0;let m=null;if(_!==0){if(m=l.value,g!==!0||m===null){const d=p+_*4,E=u.matrixWorldInverse;o.getNormalMatrix(E),(m===null||m.length<d)&&(m=new Float32Array(d));for(let y=0,S=p;y!==_;++y,S+=4)a.copy(h[y]).applyMatrix4(E,o),a.normal.toArray(m,S),m[S+3]=a.constant}l.value=m,l.needsUpdate=!0}return t.numPlanes=_,t.numIntersection=0,m}}function Yp(i){let t=new WeakMap;function e(a,o){return o===Yo?a.mapping=Qs:o===qo&&(a.mapping=tr),a}function n(a){if(a&&a.isTexture){const o=a.mapping;if(o===Yo||o===qo)if(t.has(a)){const l=t.get(a).texture;return e(l,a.mapping)}else{const l=a.image;if(l&&l.height>0){const c=new id(l.height);return c.fromEquirectangularTexture(i,a),t.set(a,c),a.addEventListener("dispose",s),e(c.texture,a.mapping)}else return null}}return a}function s(a){const o=a.target;o.removeEventListener("dispose",s);const l=t.get(o);l!==void 0&&(t.delete(o),l.dispose())}function r(){t=new WeakMap}return{get:n,dispose:r}}class Xa extends tf{constructor(t=-1,e=1,n=1,s=-1,r=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=t,this.right=e,this.top=n,this.bottom=s,this.near=r,this.far=a,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.left=t.left,this.right=t.right,this.top=t.top,this.bottom=t.bottom,this.near=t.near,this.far=t.far,this.zoom=t.zoom,this.view=t.view===null?null:Object.assign({},t.view),this}setViewOffset(t,e,n,s,r,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=(this.right-this.left)/(2*this.zoom),e=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,s=(this.top+this.bottom)/2;let r=n-t,a=n+t,o=s+e,l=s-e;if(this.view!==null&&this.view.enabled){const c=(this.right-this.left)/this.view.fullWidth/this.zoom,f=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,a=r+c*this.view.width,o-=f*this.view.offsetY,l=o-f*this.view.height}this.projectionMatrix.makeOrthographic(r,a,o,l,this.near,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const e=super.toJSON(t);return e.object.zoom=this.zoom,e.object.left=this.left,e.object.right=this.right,e.object.top=this.top,e.object.bottom=this.bottom,e.object.near=this.near,e.object.far=this.far,this.view!==null&&(e.object.view=Object.assign({},this.view)),e}}const Vs=4,Cc=[.125,.215,.35,.446,.526,.582],Qi=20,vo=new Xa,Pc=new Tt;let Mo=null,So=0,yo=0,bo=!1;const ji=(1+Math.sqrt(5))/2,As=1/ji,Lc=[new F(-ji,As,0),new F(ji,As,0),new F(-As,0,ji),new F(As,0,ji),new F(0,ji,-As),new F(0,ji,As),new F(-1,1,-1),new F(1,1,-1),new F(-1,1,1),new F(1,1,1)];class Dc{constructor(t){this._renderer=t,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(t,e=0,n=.1,s=100){Mo=this._renderer.getRenderTarget(),So=this._renderer.getActiveCubeFace(),yo=this._renderer.getActiveMipmapLevel(),bo=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(256);const r=this._allocateTargets();return r.depthBuffer=!0,this._sceneToCubeUV(t,n,s,r),e>0&&this._blur(r,0,0,e),this._applyPMREM(r),this._cleanup(r),r}fromEquirectangular(t,e=null){return this._fromTexture(t,e)}fromCubemap(t,e=null){return this._fromTexture(t,e)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Nc(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Uc(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(t){this._lodMax=Math.floor(Math.log2(t)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let t=0;t<this._lodPlanes.length;t++)this._lodPlanes[t].dispose()}_cleanup(t){this._renderer.setRenderTarget(Mo,So,yo),this._renderer.xr.enabled=bo,t.scissorTest=!1,ua(t,0,0,t.width,t.height)}_fromTexture(t,e){t.mapping===Qs||t.mapping===tr?this._setSize(t.image.length===0?16:t.image[0].width||t.image[0].image.width):this._setSize(t.image.width/4),Mo=this._renderer.getRenderTarget(),So=this._renderer.getActiveCubeFace(),yo=this._renderer.getActiveMipmapLevel(),bo=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const n=e||this._allocateTargets();return this._textureToCubeUV(t,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){const t=3*Math.max(this._cubeSize,112),e=4*this._cubeSize,n={magFilter:Yn,minFilter:Yn,generateMipmaps:!1,type:ar,format:Hn,colorSpace:ls,depthBuffer:!1},s=Ic(t,e,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==t||this._pingPongRenderTarget.height!==e){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Ic(t,e,n);const{_lodMax:r}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=qp(r)),this._blurMaterial=Zp(r,t,e)}return s}_compileMaterial(t){const e=new Rt(this._lodPlanes[0],t);this._renderer.compile(e,vo)}_sceneToCubeUV(t,e,n,s){const o=new zn(90,1,e,n),l=[1,-1,1,1,1,1],c=[1,1,1,-1,-1,-1],f=this._renderer,h=f.autoClear,u=f.toneMapping;f.getClearColor(Pc),f.toneMapping=fi,f.autoClear=!1;const p=new Xt({name:"PMREM.Background",side:vn,depthWrite:!1,depthTest:!1}),g=new Rt(new Ie,p);let _=!1;const m=t.background;m?m.isColor&&(p.color.copy(m),t.background=null,_=!0):(p.color.copy(Pc),_=!0);for(let d=0;d<6;d++){const E=d%3;E===0?(o.up.set(0,l[d],0),o.lookAt(c[d],0,0)):E===1?(o.up.set(0,0,l[d]),o.lookAt(0,c[d],0)):(o.up.set(0,l[d],0),o.lookAt(0,0,c[d]));const y=this._cubeSize;ua(s,E*y,d>2?y:0,y,y),f.setRenderTarget(s),_&&f.render(g,o),f.render(t,o)}g.geometry.dispose(),g.material.dispose(),f.toneMapping=u,f.autoClear=h,t.background=m}_textureToCubeUV(t,e){const n=this._renderer,s=t.mapping===Qs||t.mapping===tr;s?(this._cubemapMaterial===null&&(this._cubemapMaterial=Nc()),this._cubemapMaterial.uniforms.flipEnvMap.value=t.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Uc());const r=s?this._cubemapMaterial:this._equirectMaterial,a=new Rt(this._lodPlanes[0],r),o=r.uniforms;o.envMap.value=t;const l=this._cubeSize;ua(e,0,0,3*l,2*l),n.setRenderTarget(e),n.render(a,vo)}_applyPMREM(t){const e=this._renderer,n=e.autoClear;e.autoClear=!1;const s=this._lodPlanes.length;for(let r=1;r<s;r++){const a=Math.sqrt(this._sigmas[r]*this._sigmas[r]-this._sigmas[r-1]*this._sigmas[r-1]),o=Lc[(s-r-1)%Lc.length];this._blur(t,r-1,r,a,o)}e.autoClear=n}_blur(t,e,n,s,r){const a=this._pingPongRenderTarget;this._halfBlur(t,a,e,n,s,"latitudinal",r),this._halfBlur(a,t,n,n,s,"longitudinal",r)}_halfBlur(t,e,n,s,r,a,o){const l=this._renderer,c=this._blurMaterial;a!=="latitudinal"&&a!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");const f=3,h=new Rt(this._lodPlanes[s],c),u=c.uniforms,p=this._sizeLods[n]-1,g=isFinite(r)?Math.PI/(2*p):2*Math.PI/(2*Qi-1),_=r/g,m=isFinite(r)?1+Math.floor(f*_):Qi;m>Qi&&console.warn(`sigmaRadians, ${r}, is too large and will clip, as it requested ${m} samples when the maximum is set to ${Qi}`);const d=[];let E=0;for(let R=0;R<Qi;++R){const I=R/_,b=Math.exp(-I*I/2);d.push(b),R===0?E+=b:R<m&&(E+=2*b)}for(let R=0;R<d.length;R++)d[R]=d[R]/E;u.envMap.value=t.texture,u.samples.value=m,u.weights.value=d,u.latitudinal.value=a==="latitudinal",o&&(u.poleAxis.value=o);const{_lodMax:y}=this;u.dTheta.value=g,u.mipInt.value=y-n;const S=this._sizeLods[s],O=3*S*(s>y-Vs?s-y+Vs:0),T=4*(this._cubeSize-S);ua(e,O,T,3*S,2*S),l.setRenderTarget(e),l.render(h,vo)}}function qp(i){const t=[],e=[],n=[];let s=i;const r=i-Vs+1+Cc.length;for(let a=0;a<r;a++){const o=Math.pow(2,s);e.push(o);let l=1/o;a>i-Vs?l=Cc[a-i+Vs-1]:a===0&&(l=0),n.push(l);const c=1/(o-2),f=-c,h=1+c,u=[f,f,h,f,h,h,f,f,h,h,f,h],p=6,g=6,_=3,m=2,d=1,E=new Float32Array(_*g*p),y=new Float32Array(m*g*p),S=new Float32Array(d*g*p);for(let T=0;T<p;T++){const R=T%3*2/3-1,I=T>2?0:-1,b=[R,I,0,R+2/3,I,0,R+2/3,I+1,0,R,I,0,R+2/3,I+1,0,R,I+1,0];E.set(b,_*g*T),y.set(u,m*g*T);const M=[T,T,T,T,T,T];S.set(M,d*g*T)}const O=new Ge;O.setAttribute("position",new mn(E,_)),O.setAttribute("uv",new mn(y,m)),O.setAttribute("faceIndex",new mn(S,d)),t.push(O),s>Vs&&s--}return{lodPlanes:t,sizeLods:e,sigmas:n}}function Ic(i,t,e){const n=new Ui(i,t,e);return n.texture.mapping=Va,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function ua(i,t,e,n,s){i.viewport.set(t,e,n,s),i.scissor.set(t,e,n,s)}function Zp(i,t,e){const n=new Float32Array(Qi),s=new F(0,1,0);return new gi({name:"SphericalGaussianBlur",defines:{n:Qi,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/e,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:s}},vertexShader:ql(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:Di,depthTest:!1,depthWrite:!1})}function Uc(){return new gi({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:ql(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:Di,depthTest:!1,depthWrite:!1})}function Nc(){return new gi({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:ql(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Di,depthTest:!1,depthWrite:!1})}function ql(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function Kp(i){let t=new WeakMap,e=null;function n(o){if(o&&o.isTexture){const l=o.mapping,c=l===Yo||l===qo,f=l===Qs||l===tr;if(c||f){let h=t.get(o);const u=h!==void 0?h.texture.pmremVersion:0;if(o.isRenderTargetTexture&&o.pmremVersion!==u)return e===null&&(e=new Dc(i)),h=c?e.fromEquirectangular(o,h):e.fromCubemap(o,h),h.texture.pmremVersion=o.pmremVersion,t.set(o,h),h.texture;if(h!==void 0)return h.texture;{const p=o.image;return c&&p&&p.height>0||f&&p&&s(p)?(e===null&&(e=new Dc(i)),h=c?e.fromEquirectangular(o):e.fromCubemap(o),h.texture.pmremVersion=o.pmremVersion,t.set(o,h),o.addEventListener("dispose",r),h.texture):null}}}return o}function s(o){let l=0;const c=6;for(let f=0;f<c;f++)o[f]!==void 0&&l++;return l===c}function r(o){const l=o.target;l.removeEventListener("dispose",r);const c=t.get(l);c!==void 0&&(t.delete(l),c.dispose())}function a(){t=new WeakMap,e!==null&&(e.dispose(),e=null)}return{get:n,dispose:a}}function $p(i){const t={};function e(n){if(t[n]!==void 0)return t[n];let s;switch(n){case"WEBGL_depth_texture":s=i.getExtension("WEBGL_depth_texture")||i.getExtension("MOZ_WEBGL_depth_texture")||i.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":s=i.getExtension("EXT_texture_filter_anisotropic")||i.getExtension("MOZ_EXT_texture_filter_anisotropic")||i.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":s=i.getExtension("WEBGL_compressed_texture_s3tc")||i.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||i.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":s=i.getExtension("WEBGL_compressed_texture_pvrtc")||i.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:s=i.getExtension(n)}return t[n]=s,s}return{has:function(n){return e(n)!==null},init:function(){e("EXT_color_buffer_float"),e("WEBGL_clip_cull_distance"),e("OES_texture_float_linear"),e("EXT_color_buffer_half_float"),e("WEBGL_multisampled_render_to_texture"),e("WEBGL_render_shared_exponent")},get:function(n){const s=e(n);return s===null&&Ur("THREE.WebGLRenderer: "+n+" extension not supported."),s}}}function jp(i,t,e,n){const s={},r=new WeakMap;function a(h){const u=h.target;u.index!==null&&t.remove(u.index);for(const g in u.attributes)t.remove(u.attributes[g]);for(const g in u.morphAttributes){const _=u.morphAttributes[g];for(let m=0,d=_.length;m<d;m++)t.remove(_[m])}u.removeEventListener("dispose",a),delete s[u.id];const p=r.get(u);p&&(t.remove(p),r.delete(u)),n.releaseStatesOfGeometry(u),u.isInstancedBufferGeometry===!0&&delete u._maxInstanceCount,e.memory.geometries--}function o(h,u){return s[u.id]===!0||(u.addEventListener("dispose",a),s[u.id]=!0,e.memory.geometries++),u}function l(h){const u=h.attributes;for(const g in u)t.update(u[g],i.ARRAY_BUFFER);const p=h.morphAttributes;for(const g in p){const _=p[g];for(let m=0,d=_.length;m<d;m++)t.update(_[m],i.ARRAY_BUFFER)}}function c(h){const u=[],p=h.index,g=h.attributes.position;let _=0;if(p!==null){const E=p.array;_=p.version;for(let y=0,S=E.length;y<S;y+=3){const O=E[y+0],T=E[y+1],R=E[y+2];u.push(O,T,T,R,R,O)}}else if(g!==void 0){const E=g.array;_=g.version;for(let y=0,S=E.length/3-1;y<S;y+=3){const O=y+0,T=y+1,R=y+2;u.push(O,T,T,R,R,O)}}else return;const m=new(qh(u)?Xl:Wl)(u,1);m.version=_;const d=r.get(h);d&&t.remove(d),r.set(h,m)}function f(h){const u=r.get(h);if(u){const p=h.index;p!==null&&u.version<p.version&&c(h)}else c(h);return r.get(h)}return{get:o,update:l,getWireframeAttribute:f}}function Jp(i,t,e){let n;function s(u){n=u}let r,a;function o(u){r=u.type,a=u.bytesPerElement}function l(u,p){i.drawElements(n,p,r,u*a),e.update(p,n,1)}function c(u,p,g){g!==0&&(i.drawElementsInstanced(n,p,r,u*a,g),e.update(p,n,g))}function f(u,p,g){if(g===0)return;t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,p,0,r,u,0,g);let m=0;for(let d=0;d<g;d++)m+=p[d];e.update(m,n,1)}function h(u,p,g,_){if(g===0)return;const m=t.get("WEBGL_multi_draw");if(m===null)for(let d=0;d<u.length;d++)c(u[d]/a,p[d],_[d]);else{m.multiDrawElementsInstancedWEBGL(n,p,0,r,u,0,_,0,g);let d=0;for(let E=0;E<g;E++)d+=p[E]*_[E];e.update(d,n,1)}}this.setMode=s,this.setIndex=o,this.render=l,this.renderInstances=c,this.renderMultiDraw=f,this.renderMultiDrawInstances=h}function Qp(i){const t={geometries:0,textures:0},e={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,a,o){switch(e.calls++,a){case i.TRIANGLES:e.triangles+=o*(r/3);break;case i.LINES:e.lines+=o*(r/2);break;case i.LINE_STRIP:e.lines+=o*(r-1);break;case i.LINE_LOOP:e.lines+=o*r;break;case i.POINTS:e.points+=o*r;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",a);break}}function s(){e.calls=0,e.triangles=0,e.points=0,e.lines=0}return{memory:t,render:e,programs:null,autoReset:!0,reset:s,update:n}}function tm(i,t,e){const n=new WeakMap,s=new Re;function r(a,o,l){const c=a.morphTargetInfluences,f=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,h=f!==void 0?f.length:0;let u=n.get(o);if(u===void 0||u.count!==h){let b=function(){R.dispose(),n.delete(o),o.removeEventListener("dispose",b)};u!==void 0&&u.texture.dispose();const p=o.morphAttributes.position!==void 0,g=o.morphAttributes.normal!==void 0,_=o.morphAttributes.color!==void 0,m=o.morphAttributes.position||[],d=o.morphAttributes.normal||[],E=o.morphAttributes.color||[];let y=0;p===!0&&(y=1),g===!0&&(y=2),_===!0&&(y=3);let S=o.attributes.position.count*y,O=1;S>t.maxTextureSize&&(O=Math.ceil(S/t.maxTextureSize),S=t.maxTextureSize);const T=new Float32Array(S*O*4*h),R=new Kh(T,S,O,h);R.type=qn,R.needsUpdate=!0;const I=y*4;for(let M=0;M<h;M++){const A=m[M],V=d[M],z=E[M],C=S*O*4*M;for(let W=0;W<A.count;W++){const G=W*I;p===!0&&(s.fromBufferAttribute(A,W),T[C+G+0]=s.x,T[C+G+1]=s.y,T[C+G+2]=s.z,T[C+G+3]=0),g===!0&&(s.fromBufferAttribute(V,W),T[C+G+4]=s.x,T[C+G+5]=s.y,T[C+G+6]=s.z,T[C+G+7]=0),_===!0&&(s.fromBufferAttribute(z,W),T[C+G+8]=s.x,T[C+G+9]=s.y,T[C+G+10]=s.z,T[C+G+11]=z.itemSize===4?s.w:1)}}u={count:h,texture:R,size:new Yt(S,O)},n.set(o,u),o.addEventListener("dispose",b)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)l.getUniforms().setValue(i,"morphTexture",a.morphTexture,e);else{let p=0;for(let _=0;_<c.length;_++)p+=c[_];const g=o.morphTargetsRelative?1:1-p;l.getUniforms().setValue(i,"morphTargetBaseInfluence",g),l.getUniforms().setValue(i,"morphTargetInfluences",c)}l.getUniforms().setValue(i,"morphTargetsTexture",u.texture,e),l.getUniforms().setValue(i,"morphTargetsTextureSize",u.size)}return{update:r}}function em(i,t,e,n){let s=new WeakMap;function r(l){const c=n.render.frame,f=l.geometry,h=t.get(l,f);if(s.get(h)!==c&&(t.update(h),s.set(h,c)),l.isInstancedMesh&&(l.hasEventListener("dispose",o)===!1&&l.addEventListener("dispose",o),s.get(l)!==c&&(e.update(l.instanceMatrix,i.ARRAY_BUFFER),l.instanceColor!==null&&e.update(l.instanceColor,i.ARRAY_BUFFER),s.set(l,c))),l.isSkinnedMesh){const u=l.skeleton;s.get(u)!==c&&(u.update(),s.set(u,c))}return h}function a(){s=new WeakMap}function o(l){const c=l.target;c.removeEventListener("dispose",o),e.remove(c.instanceMatrix),c.instanceColor!==null&&e.remove(c.instanceColor)}return{update:r,dispose:a}}class Zl extends tn{constructor(t,e,n,s,r,a,o,l,c,f=Ks){if(f!==Ks&&f!==nr)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");n===void 0&&f===Ks&&(n=ss),n===void 0&&f===nr&&(n=er),super(null,s,r,a,o,l,f,n,c),this.isDepthTexture=!0,this.image={width:t,height:e},this.magFilter=o!==void 0?o:Ne,this.minFilter=l!==void 0?l:Ne,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(t){return super.copy(t),this.compareFunction=t.compareFunction,this}toJSON(t){const e=super.toJSON(t);return this.compareFunction!==null&&(e.compareFunction=this.compareFunction),e}}const sf=new tn,Fc=new Zl(1,1),rf=new Kh,af=new Hu,of=new ef,Oc=[],Bc=[],zc=new Float32Array(16),kc=new Float32Array(9),Hc=new Float32Array(4);function cr(i,t,e){const n=i[0];if(n<=0||n>0)return i;const s=t*e;let r=Oc[s];if(r===void 0&&(r=new Float32Array(s),Oc[s]=r),t!==0){n.toArray(r,0);for(let a=1,o=0;a!==t;++a)o+=e,i[a].toArray(r,o)}return r}function Be(i,t){if(i.length!==t.length)return!1;for(let e=0,n=i.length;e<n;e++)if(i[e]!==t[e])return!1;return!0}function ze(i,t){for(let e=0,n=t.length;e<n;e++)i[e]=t[e]}function Ya(i,t){let e=Bc[t];e===void 0&&(e=new Int32Array(t),Bc[t]=e);for(let n=0;n!==t;++n)e[n]=i.allocateTextureUnit();return e}function nm(i,t){const e=this.cache;e[0]!==t&&(i.uniform1f(this.addr,t),e[0]=t)}function im(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2f(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(Be(e,t))return;i.uniform2fv(this.addr,t),ze(e,t)}}function sm(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3f(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else if(t.r!==void 0)(e[0]!==t.r||e[1]!==t.g||e[2]!==t.b)&&(i.uniform3f(this.addr,t.r,t.g,t.b),e[0]=t.r,e[1]=t.g,e[2]=t.b);else{if(Be(e,t))return;i.uniform3fv(this.addr,t),ze(e,t)}}function rm(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4f(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(Be(e,t))return;i.uniform4fv(this.addr,t),ze(e,t)}}function am(i,t){const e=this.cache,n=t.elements;if(n===void 0){if(Be(e,t))return;i.uniformMatrix2fv(this.addr,!1,t),ze(e,t)}else{if(Be(e,n))return;Hc.set(n),i.uniformMatrix2fv(this.addr,!1,Hc),ze(e,n)}}function om(i,t){const e=this.cache,n=t.elements;if(n===void 0){if(Be(e,t))return;i.uniformMatrix3fv(this.addr,!1,t),ze(e,t)}else{if(Be(e,n))return;kc.set(n),i.uniformMatrix3fv(this.addr,!1,kc),ze(e,n)}}function lm(i,t){const e=this.cache,n=t.elements;if(n===void 0){if(Be(e,t))return;i.uniformMatrix4fv(this.addr,!1,t),ze(e,t)}else{if(Be(e,n))return;zc.set(n),i.uniformMatrix4fv(this.addr,!1,zc),ze(e,n)}}function cm(i,t){const e=this.cache;e[0]!==t&&(i.uniform1i(this.addr,t),e[0]=t)}function hm(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2i(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(Be(e,t))return;i.uniform2iv(this.addr,t),ze(e,t)}}function fm(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3i(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(Be(e,t))return;i.uniform3iv(this.addr,t),ze(e,t)}}function um(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4i(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(Be(e,t))return;i.uniform4iv(this.addr,t),ze(e,t)}}function dm(i,t){const e=this.cache;e[0]!==t&&(i.uniform1ui(this.addr,t),e[0]=t)}function pm(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2ui(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(Be(e,t))return;i.uniform2uiv(this.addr,t),ze(e,t)}}function mm(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3ui(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(Be(e,t))return;i.uniform3uiv(this.addr,t),ze(e,t)}}function gm(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4ui(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(Be(e,t))return;i.uniform4uiv(this.addr,t),ze(e,t)}}function _m(i,t,e){const n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s);let r;this.type===i.SAMPLER_2D_SHADOW?(Fc.compareFunction=Yh,r=Fc):r=sf,e.setTexture2D(t||r,s)}function xm(i,t,e){const n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTexture3D(t||af,s)}function vm(i,t,e){const n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTextureCube(t||of,s)}function Mm(i,t,e){const n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTexture2DArray(t||rf,s)}function Sm(i){switch(i){case 5126:return nm;case 35664:return im;case 35665:return sm;case 35666:return rm;case 35674:return am;case 35675:return om;case 35676:return lm;case 5124:case 35670:return cm;case 35667:case 35671:return hm;case 35668:case 35672:return fm;case 35669:case 35673:return um;case 5125:return dm;case 36294:return pm;case 36295:return mm;case 36296:return gm;case 35678:case 36198:case 36298:case 36306:case 35682:return _m;case 35679:case 36299:case 36307:return xm;case 35680:case 36300:case 36308:case 36293:return vm;case 36289:case 36303:case 36311:case 36292:return Mm}}function ym(i,t){i.uniform1fv(this.addr,t)}function bm(i,t){const e=cr(t,this.size,2);i.uniform2fv(this.addr,e)}function Em(i,t){const e=cr(t,this.size,3);i.uniform3fv(this.addr,e)}function wm(i,t){const e=cr(t,this.size,4);i.uniform4fv(this.addr,e)}function Tm(i,t){const e=cr(t,this.size,4);i.uniformMatrix2fv(this.addr,!1,e)}function Am(i,t){const e=cr(t,this.size,9);i.uniformMatrix3fv(this.addr,!1,e)}function Rm(i,t){const e=cr(t,this.size,16);i.uniformMatrix4fv(this.addr,!1,e)}function Cm(i,t){i.uniform1iv(this.addr,t)}function Pm(i,t){i.uniform2iv(this.addr,t)}function Lm(i,t){i.uniform3iv(this.addr,t)}function Dm(i,t){i.uniform4iv(this.addr,t)}function Im(i,t){i.uniform1uiv(this.addr,t)}function Um(i,t){i.uniform2uiv(this.addr,t)}function Nm(i,t){i.uniform3uiv(this.addr,t)}function Fm(i,t){i.uniform4uiv(this.addr,t)}function Om(i,t,e){const n=this.cache,s=t.length,r=Ya(e,s);Be(n,r)||(i.uniform1iv(this.addr,r),ze(n,r));for(let a=0;a!==s;++a)e.setTexture2D(t[a]||sf,r[a])}function Bm(i,t,e){const n=this.cache,s=t.length,r=Ya(e,s);Be(n,r)||(i.uniform1iv(this.addr,r),ze(n,r));for(let a=0;a!==s;++a)e.setTexture3D(t[a]||af,r[a])}function zm(i,t,e){const n=this.cache,s=t.length,r=Ya(e,s);Be(n,r)||(i.uniform1iv(this.addr,r),ze(n,r));for(let a=0;a!==s;++a)e.setTextureCube(t[a]||of,r[a])}function km(i,t,e){const n=this.cache,s=t.length,r=Ya(e,s);Be(n,r)||(i.uniform1iv(this.addr,r),ze(n,r));for(let a=0;a!==s;++a)e.setTexture2DArray(t[a]||rf,r[a])}function Hm(i){switch(i){case 5126:return ym;case 35664:return bm;case 35665:return Em;case 35666:return wm;case 35674:return Tm;case 35675:return Am;case 35676:return Rm;case 5124:case 35670:return Cm;case 35667:case 35671:return Pm;case 35668:case 35672:return Lm;case 35669:case 35673:return Dm;case 5125:return Im;case 36294:return Um;case 36295:return Nm;case 36296:return Fm;case 35678:case 36198:case 36298:case 36306:case 35682:return Om;case 35679:case 36299:case 36307:return Bm;case 35680:case 36300:case 36308:case 36293:return zm;case 36289:case 36303:case 36311:case 36292:return km}}class Gm{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.setValue=Sm(e.type)}}class Vm{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.size=e.size,this.setValue=Hm(e.type)}}class Wm{constructor(t){this.id=t,this.seq=[],this.map={}}setValue(t,e,n){const s=this.seq;for(let r=0,a=s.length;r!==a;++r){const o=s[r];o.setValue(t,e[o.id],n)}}}const Eo=/(\w+)(\])?(\[|\.)?/g;function Gc(i,t){i.seq.push(t),i.map[t.id]=t}function Xm(i,t,e){const n=i.name,s=n.length;for(Eo.lastIndex=0;;){const r=Eo.exec(n),a=Eo.lastIndex;let o=r[1];const l=r[2]==="]",c=r[3];if(l&&(o=o|0),c===void 0||c==="["&&a+2===s){Gc(e,c===void 0?new Gm(o,i,t):new Vm(o,i,t));break}else{let h=e.map[o];h===void 0&&(h=new Wm(o),Gc(e,h)),e=h}}}class Ia{constructor(t,e){this.seq=[],this.map={};const n=t.getProgramParameter(e,t.ACTIVE_UNIFORMS);for(let s=0;s<n;++s){const r=t.getActiveUniform(e,s),a=t.getUniformLocation(e,r.name);Xm(r,a,this)}}setValue(t,e,n,s){const r=this.map[e];r!==void 0&&r.setValue(t,n,s)}setOptional(t,e,n){const s=e[n];s!==void 0&&this.setValue(t,n,s)}static upload(t,e,n,s){for(let r=0,a=e.length;r!==a;++r){const o=e[r],l=n[o.id];l.needsUpdate!==!1&&o.setValue(t,l.value,s)}}static seqWithValue(t,e){const n=[];for(let s=0,r=t.length;s!==r;++s){const a=t[s];a.id in e&&n.push(a)}return n}}function Vc(i,t,e){const n=i.createShader(t);return i.shaderSource(n,e),i.compileShader(n),n}const Ym=37297;let qm=0;function Zm(i,t){const e=i.split(`
`),n=[],s=Math.max(t-6,0),r=Math.min(t+6,e.length);for(let a=s;a<r;a++){const o=a+1;n.push(`${o===t?">":" "} ${o}: ${e[a]}`)}return n.join(`
`)}const Wc=new Ht;function Km(i){ae._getMatrix(Wc,ae.workingColorSpace,i);const t=`mat3( ${Wc.elements.map(e=>e.toFixed(4))} )`;switch(ae.getTransfer(i)){case Wa:return[t,"LinearTransferOETF"];case ge:return[t,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space: ",i),[t,"LinearTransferOETF"]}}function Xc(i,t,e){const n=i.getShaderParameter(t,i.COMPILE_STATUS),s=i.getShaderInfoLog(t).trim();if(n&&s==="")return"";const r=/ERROR: 0:(\d+)/.exec(s);if(r){const a=parseInt(r[1]);return e.toUpperCase()+`

`+s+`

`+Zm(i.getShaderSource(t),a)}else return s}function $m(i,t){const e=Km(t);return[`vec4 ${i}( vec4 value ) {`,`	return ${e[1]}( vec4( value.rgb * ${e[0]}, value.a ) );`,"}"].join(`
`)}function jm(i,t){let e;switch(t){case Qf:e="Linear";break;case tu:e="Reinhard";break;case eu:e="Cineon";break;case nu:e="ACESFilmic";break;case su:e="AgX";break;case ru:e="Neutral";break;case iu:e="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",t),e="Linear"}return"vec3 "+i+"( vec3 color ) { return "+e+"ToneMapping( color ); }"}const da=new F;function Jm(){ae.getLuminanceCoefficients(da);const i=da.x.toFixed(4),t=da.y.toFixed(4),e=da.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${i}, ${t}, ${e} );`,"	return dot( weights, rgb );","}"].join(`
`)}function Qm(i){return[i.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",i.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(Nr).join(`
`)}function tg(i){const t=[];for(const e in i){const n=i[e];n!==!1&&t.push("#define "+e+" "+n)}return t.join(`
`)}function eg(i,t){const e={},n=i.getProgramParameter(t,i.ACTIVE_ATTRIBUTES);for(let s=0;s<n;s++){const r=i.getActiveAttrib(t,s),a=r.name;let o=1;r.type===i.FLOAT_MAT2&&(o=2),r.type===i.FLOAT_MAT3&&(o=3),r.type===i.FLOAT_MAT4&&(o=4),e[a]={type:r.type,location:i.getAttribLocation(t,a),locationSize:o}}return e}function Nr(i){return i!==""}function Yc(i,t){const e=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return i.replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,e).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function qc(i,t){return i.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}const ng=/^[ \t]*#include +<([\w\d./]+)>/gm;function El(i){return i.replace(ng,sg)}const ig=new Map;function sg(i,t){let e=Wt[t];if(e===void 0){const n=ig.get(t);if(n!==void 0)e=Wt[n],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,n);else throw new Error("Can not resolve #include <"+t+">")}return El(e)}const rg=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Zc(i){return i.replace(rg,ag)}function ag(i,t,e,n){let s="";for(let r=parseInt(t);r<parseInt(e);r++)s+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return s}function Kc(i){let t=`precision ${i.precision} float;
	precision ${i.precision} int;
	precision ${i.precision} sampler2D;
	precision ${i.precision} samplerCube;
	precision ${i.precision} sampler3D;
	precision ${i.precision} sampler2DArray;
	precision ${i.precision} sampler2DShadow;
	precision ${i.precision} samplerCubeShadow;
	precision ${i.precision} sampler2DArrayShadow;
	precision ${i.precision} isampler2D;
	precision ${i.precision} isampler3D;
	precision ${i.precision} isamplerCube;
	precision ${i.precision} isampler2DArray;
	precision ${i.precision} usampler2D;
	precision ${i.precision} usampler3D;
	precision ${i.precision} usamplerCube;
	precision ${i.precision} usampler2DArray;
	`;return i.precision==="highp"?t+=`
#define HIGH_PRECISION`:i.precision==="mediump"?t+=`
#define MEDIUM_PRECISION`:i.precision==="lowp"&&(t+=`
#define LOW_PRECISION`),t}function og(i){let t="SHADOWMAP_TYPE_BASIC";return i.shadowMapType===Ih?t="SHADOWMAP_TYPE_PCF":i.shadowMapType===Uh?t="SHADOWMAP_TYPE_PCF_SOFT":i.shadowMapType===li&&(t="SHADOWMAP_TYPE_VSM"),t}function lg(i){let t="ENVMAP_TYPE_CUBE";if(i.envMap)switch(i.envMapMode){case Qs:case tr:t="ENVMAP_TYPE_CUBE";break;case Va:t="ENVMAP_TYPE_CUBE_UV";break}return t}function cg(i){let t="ENVMAP_MODE_REFLECTION";if(i.envMap)switch(i.envMapMode){case tr:t="ENVMAP_MODE_REFRACTION";break}return t}function hg(i){let t="ENVMAP_BLENDING_NONE";if(i.envMap)switch(i.combine){case Nl:t="ENVMAP_BLENDING_MULTIPLY";break;case jf:t="ENVMAP_BLENDING_MIX";break;case Jf:t="ENVMAP_BLENDING_ADD";break}return t}function fg(i){const t=i.envMapCubeUVHeight;if(t===null)return null;const e=Math.log2(t)-2,n=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,e),112)),texelHeight:n,maxMip:e}}function ug(i,t,e,n){const s=i.getContext(),r=e.defines;let a=e.vertexShader,o=e.fragmentShader;const l=og(e),c=lg(e),f=cg(e),h=hg(e),u=fg(e),p=Qm(e),g=tg(r),_=s.createProgram();let m,d,E=e.glslVersion?"#version "+e.glslVersion+`
`:"";e.isRawShaderMaterial?(m=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g].filter(Nr).join(`
`),m.length>0&&(m+=`
`),d=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g].filter(Nr).join(`
`),d.length>0&&(d+=`
`)):(m=[Kc(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g,e.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",e.batching?"#define USE_BATCHING":"",e.batchingColor?"#define USE_BATCHING_COLOR":"",e.instancing?"#define USE_INSTANCING":"",e.instancingColor?"#define USE_INSTANCING_COLOR":"",e.instancingMorph?"#define USE_INSTANCING_MORPH":"",e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.map?"#define USE_MAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+f:"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.displacementMap?"#define USE_DISPLACEMENTMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.mapUv?"#define MAP_UV "+e.mapUv:"",e.alphaMapUv?"#define ALPHAMAP_UV "+e.alphaMapUv:"",e.lightMapUv?"#define LIGHTMAP_UV "+e.lightMapUv:"",e.aoMapUv?"#define AOMAP_UV "+e.aoMapUv:"",e.emissiveMapUv?"#define EMISSIVEMAP_UV "+e.emissiveMapUv:"",e.bumpMapUv?"#define BUMPMAP_UV "+e.bumpMapUv:"",e.normalMapUv?"#define NORMALMAP_UV "+e.normalMapUv:"",e.displacementMapUv?"#define DISPLACEMENTMAP_UV "+e.displacementMapUv:"",e.metalnessMapUv?"#define METALNESSMAP_UV "+e.metalnessMapUv:"",e.roughnessMapUv?"#define ROUGHNESSMAP_UV "+e.roughnessMapUv:"",e.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+e.anisotropyMapUv:"",e.clearcoatMapUv?"#define CLEARCOATMAP_UV "+e.clearcoatMapUv:"",e.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+e.clearcoatNormalMapUv:"",e.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+e.clearcoatRoughnessMapUv:"",e.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+e.iridescenceMapUv:"",e.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+e.iridescenceThicknessMapUv:"",e.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+e.sheenColorMapUv:"",e.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+e.sheenRoughnessMapUv:"",e.specularMapUv?"#define SPECULARMAP_UV "+e.specularMapUv:"",e.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+e.specularColorMapUv:"",e.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+e.specularIntensityMapUv:"",e.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+e.transmissionMapUv:"",e.thicknessMapUv?"#define THICKNESSMAP_UV "+e.thicknessMapUv:"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.flatShading?"#define FLAT_SHADED":"",e.skinning?"#define USE_SKINNING":"",e.morphTargets?"#define USE_MORPHTARGETS":"",e.morphNormals&&e.flatShading===!1?"#define USE_MORPHNORMALS":"",e.morphColors?"#define USE_MORPHCOLORS":"",e.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+e.morphTextureStride:"",e.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+e.morphTargetsCount:"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.sizeAttenuation?"#define USE_SIZEATTENUATION":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",e.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(Nr).join(`
`),d=[Kc(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g,e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",e.map?"#define USE_MAP":"",e.matcap?"#define USE_MATCAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+c:"",e.envMap?"#define "+f:"",e.envMap?"#define "+h:"",u?"#define CUBEUV_TEXEL_WIDTH "+u.texelWidth:"",u?"#define CUBEUV_TEXEL_HEIGHT "+u.texelHeight:"",u?"#define CUBEUV_MAX_MIP "+u.maxMip+".0":"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoat?"#define USE_CLEARCOAT":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.dispersion?"#define USE_DISPERSION":"",e.iridescence?"#define USE_IRIDESCENCE":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaTest?"#define USE_ALPHATEST":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.sheen?"#define USE_SHEEN":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors||e.instancingColor||e.batchingColor?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.gradientMap?"#define USE_GRADIENTMAP":"",e.flatShading?"#define FLAT_SHADED":"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",e.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",e.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",e.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",e.toneMapping!==fi?"#define TONE_MAPPING":"",e.toneMapping!==fi?Wt.tonemapping_pars_fragment:"",e.toneMapping!==fi?jm("toneMapping",e.toneMapping):"",e.dithering?"#define DITHERING":"",e.opaque?"#define OPAQUE":"",Wt.colorspace_pars_fragment,$m("linearToOutputTexel",e.outputColorSpace),Jm(),e.useDepthPacking?"#define DEPTH_PACKING "+e.depthPacking:"",`
`].filter(Nr).join(`
`)),a=El(a),a=Yc(a,e),a=qc(a,e),o=El(o),o=Yc(o,e),o=qc(o,e),a=Zc(a),o=Zc(o),e.isRawShaderMaterial!==!0&&(E=`#version 300 es
`,m=[p,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,d=["#define varying in",e.glslVersion===oc?"":"layout(location = 0) out highp vec4 pc_fragColor;",e.glslVersion===oc?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+d);const y=E+m+a,S=E+d+o,O=Vc(s,s.VERTEX_SHADER,y),T=Vc(s,s.FRAGMENT_SHADER,S);s.attachShader(_,O),s.attachShader(_,T),e.index0AttributeName!==void 0?s.bindAttribLocation(_,0,e.index0AttributeName):e.morphTargets===!0&&s.bindAttribLocation(_,0,"position"),s.linkProgram(_);function R(A){if(i.debug.checkShaderErrors){const V=s.getProgramInfoLog(_).trim(),z=s.getShaderInfoLog(O).trim(),C=s.getShaderInfoLog(T).trim();let W=!0,G=!0;if(s.getProgramParameter(_,s.LINK_STATUS)===!1)if(W=!1,typeof i.debug.onShaderError=="function")i.debug.onShaderError(s,_,O,T);else{const Z=Xc(s,O,"vertex"),H=Xc(s,T,"fragment");console.error("THREE.WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(_,s.VALIDATE_STATUS)+`

Material Name: `+A.name+`
Material Type: `+A.type+`

Program Info Log: `+V+`
`+Z+`
`+H)}else V!==""?console.warn("THREE.WebGLProgram: Program Info Log:",V):(z===""||C==="")&&(G=!1);G&&(A.diagnostics={runnable:W,programLog:V,vertexShader:{log:z,prefix:m},fragmentShader:{log:C,prefix:d}})}s.deleteShader(O),s.deleteShader(T),I=new Ia(s,_),b=eg(s,_)}let I;this.getUniforms=function(){return I===void 0&&R(this),I};let b;this.getAttributes=function(){return b===void 0&&R(this),b};let M=e.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return M===!1&&(M=s.getProgramParameter(_,Ym)),M},this.destroy=function(){n.releaseStatesOfProgram(this),s.deleteProgram(_),this.program=void 0},this.type=e.shaderType,this.name=e.shaderName,this.id=qm++,this.cacheKey=t,this.usedTimes=1,this.program=_,this.vertexShader=O,this.fragmentShader=T,this}let dg=0;class pg{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(t){const e=t.vertexShader,n=t.fragmentShader,s=this._getShaderStage(e),r=this._getShaderStage(n),a=this._getShaderCacheForMaterial(t);return a.has(s)===!1&&(a.add(s),s.usedTimes++),a.has(r)===!1&&(a.add(r),r.usedTimes++),this}remove(t){const e=this.materialCache.get(t);for(const n of e)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(t),this}getVertexShaderID(t){return this._getShaderStage(t.vertexShader).id}getFragmentShaderID(t){return this._getShaderStage(t.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(t){const e=this.materialCache;let n=e.get(t);return n===void 0&&(n=new Set,e.set(t,n)),n}_getShaderStage(t){const e=this.shaderCache;let n=e.get(t);return n===void 0&&(n=new mg(t),e.set(t,n)),n}}class mg{constructor(t){this.id=dg++,this.code=t,this.usedTimes=0}}function gg(i,t,e,n,s,r,a){const o=new jh,l=new pg,c=new Set,f=[],h=s.logarithmicDepthBuffer,u=s.vertexTextures;let p=s.precision;const g={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function _(b){return c.add(b),b===0?"uv":`uv${b}`}function m(b,M,A,V,z){const C=V.fog,W=z.geometry,G=b.isMeshStandardMaterial?V.environment:null,Z=(b.isMeshStandardMaterial?e:t).get(b.envMap||G),H=Z&&Z.mapping===Va?Z.image.height:null,it=g[b.type];b.precision!==null&&(p=s.getMaxPrecision(b.precision),p!==b.precision&&console.warn("THREE.WebGLProgram.getParameters:",b.precision,"not supported, using",p,"instead."));const ot=W.morphAttributes.position||W.morphAttributes.normal||W.morphAttributes.color,gt=ot!==void 0?ot.length:0;let Ct=0;W.morphAttributes.position!==void 0&&(Ct=1),W.morphAttributes.normal!==void 0&&(Ct=2),W.morphAttributes.color!==void 0&&(Ct=3);let Jt,Y,tt,_t;if(it){const ie=Xn[it];Jt=ie.vertexShader,Y=ie.fragmentShader}else Jt=b.vertexShader,Y=b.fragmentShader,l.update(b),tt=l.getVertexShaderID(b),_t=l.getFragmentShaderID(b);const st=i.getRenderTarget(),Lt=i.state.buffers.depth.getReversed(),It=z.isInstancedMesh===!0,zt=z.isBatchedMesh===!0,_e=!!b.map,qt=!!b.matcap,Se=!!Z,U=!!b.aoMap,Ze=!!b.lightMap,Gt=!!b.bumpMap,$t=!!b.normalMap,Et=!!b.displacementMap,oe=!!b.emissiveMap,At=!!b.metalnessMap,w=!!b.roughnessMap,x=b.anisotropy>0,B=b.clearcoat>0,$=b.dispersion>0,J=b.iridescence>0,K=b.sheen>0,xt=b.transmission>0,rt=x&&!!b.anisotropyMap,pt=B&&!!b.clearcoatMap,Zt=B&&!!b.clearcoatNormalMap,Q=B&&!!b.clearcoatRoughnessMap,mt=J&&!!b.iridescenceMap,Dt=J&&!!b.iridescenceThicknessMap,ht=K&&!!b.sheenColorMap,ut=K&&!!b.sheenRoughnessMap,jt=!!b.specularMap,Ut=!!b.specularColorMap,Pt=!!b.specularIntensityMap,L=xt&&!!b.transmissionMap,lt=xt&&!!b.thicknessMap,X=!!b.gradientMap,j=!!b.alphaMap,dt=b.alphaTest>0,at=!!b.alphaHash,Ft=!!b.extensions;let ye=fi;b.toneMapped&&(st===null||st.isXRRenderTarget===!0)&&(ye=i.toneMapping);const Vt={shaderID:it,shaderType:b.type,shaderName:b.name,vertexShader:Jt,fragmentShader:Y,defines:b.defines,customVertexShaderID:tt,customFragmentShaderID:_t,isRawShaderMaterial:b.isRawShaderMaterial===!0,glslVersion:b.glslVersion,precision:p,batching:zt,batchingColor:zt&&z._colorsTexture!==null,instancing:It,instancingColor:It&&z.instanceColor!==null,instancingMorph:It&&z.morphTexture!==null,supportsVertexTextures:u,outputColorSpace:st===null?i.outputColorSpace:st.isXRRenderTarget===!0?st.texture.colorSpace:ls,alphaToCoverage:!!b.alphaToCoverage,map:_e,matcap:qt,envMap:Se,envMapMode:Se&&Z.mapping,envMapCubeUVHeight:H,aoMap:U,lightMap:Ze,bumpMap:Gt,normalMap:$t,displacementMap:u&&Et,emissiveMap:oe,normalMapObjectSpace:$t&&b.normalMapType===cu,normalMapTangentSpace:$t&&b.normalMapType===Xh,metalnessMap:At,roughnessMap:w,anisotropy:x,anisotropyMap:rt,clearcoat:B,clearcoatMap:pt,clearcoatNormalMap:Zt,clearcoatRoughnessMap:Q,dispersion:$,iridescence:J,iridescenceMap:mt,iridescenceThicknessMap:Dt,sheen:K,sheenColorMap:ht,sheenRoughnessMap:ut,specularMap:jt,specularColorMap:Ut,specularIntensityMap:Pt,transmission:xt,transmissionMap:L,thicknessMap:lt,gradientMap:X,opaque:b.transparent===!1&&b.blending===Zs&&b.alphaToCoverage===!1,alphaMap:j,alphaTest:dt,alphaHash:at,combine:b.combine,mapUv:_e&&_(b.map.channel),aoMapUv:U&&_(b.aoMap.channel),lightMapUv:Ze&&_(b.lightMap.channel),bumpMapUv:Gt&&_(b.bumpMap.channel),normalMapUv:$t&&_(b.normalMap.channel),displacementMapUv:Et&&_(b.displacementMap.channel),emissiveMapUv:oe&&_(b.emissiveMap.channel),metalnessMapUv:At&&_(b.metalnessMap.channel),roughnessMapUv:w&&_(b.roughnessMap.channel),anisotropyMapUv:rt&&_(b.anisotropyMap.channel),clearcoatMapUv:pt&&_(b.clearcoatMap.channel),clearcoatNormalMapUv:Zt&&_(b.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:Q&&_(b.clearcoatRoughnessMap.channel),iridescenceMapUv:mt&&_(b.iridescenceMap.channel),iridescenceThicknessMapUv:Dt&&_(b.iridescenceThicknessMap.channel),sheenColorMapUv:ht&&_(b.sheenColorMap.channel),sheenRoughnessMapUv:ut&&_(b.sheenRoughnessMap.channel),specularMapUv:jt&&_(b.specularMap.channel),specularColorMapUv:Ut&&_(b.specularColorMap.channel),specularIntensityMapUv:Pt&&_(b.specularIntensityMap.channel),transmissionMapUv:L&&_(b.transmissionMap.channel),thicknessMapUv:lt&&_(b.thicknessMap.channel),alphaMapUv:j&&_(b.alphaMap.channel),vertexTangents:!!W.attributes.tangent&&($t||x),vertexColors:b.vertexColors,vertexAlphas:b.vertexColors===!0&&!!W.attributes.color&&W.attributes.color.itemSize===4,pointsUvs:z.isPoints===!0&&!!W.attributes.uv&&(_e||j),fog:!!C,useFog:b.fog===!0,fogExp2:!!C&&C.isFogExp2,flatShading:b.flatShading===!0,sizeAttenuation:b.sizeAttenuation===!0,logarithmicDepthBuffer:h,reverseDepthBuffer:Lt,skinning:z.isSkinnedMesh===!0,morphTargets:W.morphAttributes.position!==void 0,morphNormals:W.morphAttributes.normal!==void 0,morphColors:W.morphAttributes.color!==void 0,morphTargetsCount:gt,morphTextureStride:Ct,numDirLights:M.directional.length,numPointLights:M.point.length,numSpotLights:M.spot.length,numSpotLightMaps:M.spotLightMap.length,numRectAreaLights:M.rectArea.length,numHemiLights:M.hemi.length,numDirLightShadows:M.directionalShadowMap.length,numPointLightShadows:M.pointShadowMap.length,numSpotLightShadows:M.spotShadowMap.length,numSpotLightShadowsWithMaps:M.numSpotLightShadowsWithMaps,numLightProbes:M.numLightProbes,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:b.dithering,shadowMapEnabled:i.shadowMap.enabled&&A.length>0,shadowMapType:i.shadowMap.type,toneMapping:ye,decodeVideoTexture:_e&&b.map.isVideoTexture===!0&&ae.getTransfer(b.map.colorSpace)===ge,decodeVideoTextureEmissive:oe&&b.emissiveMap.isVideoTexture===!0&&ae.getTransfer(b.emissiveMap.colorSpace)===ge,premultipliedAlpha:b.premultipliedAlpha,doubleSided:b.side===Ln,flipSided:b.side===vn,useDepthPacking:b.depthPacking>=0,depthPacking:b.depthPacking||0,index0AttributeName:b.index0AttributeName,extensionClipCullDistance:Ft&&b.extensions.clipCullDistance===!0&&n.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(Ft&&b.extensions.multiDraw===!0||zt)&&n.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:b.customProgramCacheKey()};return Vt.vertexUv1s=c.has(1),Vt.vertexUv2s=c.has(2),Vt.vertexUv3s=c.has(3),c.clear(),Vt}function d(b){const M=[];if(b.shaderID?M.push(b.shaderID):(M.push(b.customVertexShaderID),M.push(b.customFragmentShaderID)),b.defines!==void 0)for(const A in b.defines)M.push(A),M.push(b.defines[A]);return b.isRawShaderMaterial===!1&&(E(M,b),y(M,b),M.push(i.outputColorSpace)),M.push(b.customProgramCacheKey),M.join()}function E(b,M){b.push(M.precision),b.push(M.outputColorSpace),b.push(M.envMapMode),b.push(M.envMapCubeUVHeight),b.push(M.mapUv),b.push(M.alphaMapUv),b.push(M.lightMapUv),b.push(M.aoMapUv),b.push(M.bumpMapUv),b.push(M.normalMapUv),b.push(M.displacementMapUv),b.push(M.emissiveMapUv),b.push(M.metalnessMapUv),b.push(M.roughnessMapUv),b.push(M.anisotropyMapUv),b.push(M.clearcoatMapUv),b.push(M.clearcoatNormalMapUv),b.push(M.clearcoatRoughnessMapUv),b.push(M.iridescenceMapUv),b.push(M.iridescenceThicknessMapUv),b.push(M.sheenColorMapUv),b.push(M.sheenRoughnessMapUv),b.push(M.specularMapUv),b.push(M.specularColorMapUv),b.push(M.specularIntensityMapUv),b.push(M.transmissionMapUv),b.push(M.thicknessMapUv),b.push(M.combine),b.push(M.fogExp2),b.push(M.sizeAttenuation),b.push(M.morphTargetsCount),b.push(M.morphAttributeCount),b.push(M.numDirLights),b.push(M.numPointLights),b.push(M.numSpotLights),b.push(M.numSpotLightMaps),b.push(M.numHemiLights),b.push(M.numRectAreaLights),b.push(M.numDirLightShadows),b.push(M.numPointLightShadows),b.push(M.numSpotLightShadows),b.push(M.numSpotLightShadowsWithMaps),b.push(M.numLightProbes),b.push(M.shadowMapType),b.push(M.toneMapping),b.push(M.numClippingPlanes),b.push(M.numClipIntersection),b.push(M.depthPacking)}function y(b,M){o.disableAll(),M.supportsVertexTextures&&o.enable(0),M.instancing&&o.enable(1),M.instancingColor&&o.enable(2),M.instancingMorph&&o.enable(3),M.matcap&&o.enable(4),M.envMap&&o.enable(5),M.normalMapObjectSpace&&o.enable(6),M.normalMapTangentSpace&&o.enable(7),M.clearcoat&&o.enable(8),M.iridescence&&o.enable(9),M.alphaTest&&o.enable(10),M.vertexColors&&o.enable(11),M.vertexAlphas&&o.enable(12),M.vertexUv1s&&o.enable(13),M.vertexUv2s&&o.enable(14),M.vertexUv3s&&o.enable(15),M.vertexTangents&&o.enable(16),M.anisotropy&&o.enable(17),M.alphaHash&&o.enable(18),M.batching&&o.enable(19),M.dispersion&&o.enable(20),M.batchingColor&&o.enable(21),b.push(o.mask),o.disableAll(),M.fog&&o.enable(0),M.useFog&&o.enable(1),M.flatShading&&o.enable(2),M.logarithmicDepthBuffer&&o.enable(3),M.reverseDepthBuffer&&o.enable(4),M.skinning&&o.enable(5),M.morphTargets&&o.enable(6),M.morphNormals&&o.enable(7),M.morphColors&&o.enable(8),M.premultipliedAlpha&&o.enable(9),M.shadowMapEnabled&&o.enable(10),M.doubleSided&&o.enable(11),M.flipSided&&o.enable(12),M.useDepthPacking&&o.enable(13),M.dithering&&o.enable(14),M.transmission&&o.enable(15),M.sheen&&o.enable(16),M.opaque&&o.enable(17),M.pointsUvs&&o.enable(18),M.decodeVideoTexture&&o.enable(19),M.decodeVideoTextureEmissive&&o.enable(20),M.alphaToCoverage&&o.enable(21),b.push(o.mask)}function S(b){const M=g[b.type];let A;if(M){const V=Xn[M];A=Qu.clone(V.uniforms)}else A=b.uniforms;return A}function O(b,M){let A;for(let V=0,z=f.length;V<z;V++){const C=f[V];if(C.cacheKey===M){A=C,++A.usedTimes;break}}return A===void 0&&(A=new ug(i,M,b,r),f.push(A)),A}function T(b){if(--b.usedTimes===0){const M=f.indexOf(b);f[M]=f[f.length-1],f.pop(),b.destroy()}}function R(b){l.remove(b)}function I(){l.dispose()}return{getParameters:m,getProgramCacheKey:d,getUniforms:S,acquireProgram:O,releaseProgram:T,releaseShaderCache:R,programs:f,dispose:I}}function _g(){let i=new WeakMap;function t(a){return i.has(a)}function e(a){let o=i.get(a);return o===void 0&&(o={},i.set(a,o)),o}function n(a){i.delete(a)}function s(a,o,l){i.get(a)[o]=l}function r(){i=new WeakMap}return{has:t,get:e,remove:n,update:s,dispose:r}}function xg(i,t){return i.groupOrder!==t.groupOrder?i.groupOrder-t.groupOrder:i.renderOrder!==t.renderOrder?i.renderOrder-t.renderOrder:i.material.id!==t.material.id?i.material.id-t.material.id:i.z!==t.z?i.z-t.z:i.id-t.id}function $c(i,t){return i.groupOrder!==t.groupOrder?i.groupOrder-t.groupOrder:i.renderOrder!==t.renderOrder?i.renderOrder-t.renderOrder:i.z!==t.z?t.z-i.z:i.id-t.id}function jc(){const i=[];let t=0;const e=[],n=[],s=[];function r(){t=0,e.length=0,n.length=0,s.length=0}function a(h,u,p,g,_,m){let d=i[t];return d===void 0?(d={id:h.id,object:h,geometry:u,material:p,groupOrder:g,renderOrder:h.renderOrder,z:_,group:m},i[t]=d):(d.id=h.id,d.object=h,d.geometry=u,d.material=p,d.groupOrder=g,d.renderOrder=h.renderOrder,d.z=_,d.group=m),t++,d}function o(h,u,p,g,_,m){const d=a(h,u,p,g,_,m);p.transmission>0?n.push(d):p.transparent===!0?s.push(d):e.push(d)}function l(h,u,p,g,_,m){const d=a(h,u,p,g,_,m);p.transmission>0?n.unshift(d):p.transparent===!0?s.unshift(d):e.unshift(d)}function c(h,u){e.length>1&&e.sort(h||xg),n.length>1&&n.sort(u||$c),s.length>1&&s.sort(u||$c)}function f(){for(let h=t,u=i.length;h<u;h++){const p=i[h];if(p.id===null)break;p.id=null,p.object=null,p.geometry=null,p.material=null,p.group=null}}return{opaque:e,transmissive:n,transparent:s,init:r,push:o,unshift:l,finish:f,sort:c}}function vg(){let i=new WeakMap;function t(n,s){const r=i.get(n);let a;return r===void 0?(a=new jc,i.set(n,[a])):s>=r.length?(a=new jc,r.push(a)):a=r[s],a}function e(){i=new WeakMap}return{get:t,dispose:e}}function Mg(){const i={};return{get:function(t){if(i[t.id]!==void 0)return i[t.id];let e;switch(t.type){case"DirectionalLight":e={direction:new F,color:new Tt};break;case"SpotLight":e={position:new F,direction:new F,color:new Tt,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":e={position:new F,color:new Tt,distance:0,decay:0};break;case"HemisphereLight":e={direction:new F,skyColor:new Tt,groundColor:new Tt};break;case"RectAreaLight":e={color:new Tt,position:new F,halfWidth:new F,halfHeight:new F};break}return i[t.id]=e,e}}}function Sg(){const i={};return{get:function(t){if(i[t.id]!==void 0)return i[t.id];let e;switch(t.type){case"DirectionalLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Yt};break;case"SpotLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Yt};break;case"PointLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Yt,shadowCameraNear:1,shadowCameraFar:1e3};break}return i[t.id]=e,e}}}let yg=0;function bg(i,t){return(t.castShadow?2:0)-(i.castShadow?2:0)+(t.map?1:0)-(i.map?1:0)}function Eg(i){const t=new Mg,e=Sg(),n={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)n.probe.push(new F);const s=new F,r=new ue,a=new ue;function o(c){let f=0,h=0,u=0;for(let b=0;b<9;b++)n.probe[b].set(0,0,0);let p=0,g=0,_=0,m=0,d=0,E=0,y=0,S=0,O=0,T=0,R=0;c.sort(bg);for(let b=0,M=c.length;b<M;b++){const A=c[b],V=A.color,z=A.intensity,C=A.distance,W=A.shadow&&A.shadow.map?A.shadow.map.texture:null;if(A.isAmbientLight)f+=V.r*z,h+=V.g*z,u+=V.b*z;else if(A.isLightProbe){for(let G=0;G<9;G++)n.probe[G].addScaledVector(A.sh.coefficients[G],z);R++}else if(A.isDirectionalLight){const G=t.get(A);if(G.color.copy(A.color).multiplyScalar(A.intensity),A.castShadow){const Z=A.shadow,H=e.get(A);H.shadowIntensity=Z.intensity,H.shadowBias=Z.bias,H.shadowNormalBias=Z.normalBias,H.shadowRadius=Z.radius,H.shadowMapSize=Z.mapSize,n.directionalShadow[p]=H,n.directionalShadowMap[p]=W,n.directionalShadowMatrix[p]=A.shadow.matrix,E++}n.directional[p]=G,p++}else if(A.isSpotLight){const G=t.get(A);G.position.setFromMatrixPosition(A.matrixWorld),G.color.copy(V).multiplyScalar(z),G.distance=C,G.coneCos=Math.cos(A.angle),G.penumbraCos=Math.cos(A.angle*(1-A.penumbra)),G.decay=A.decay,n.spot[_]=G;const Z=A.shadow;if(A.map&&(n.spotLightMap[O]=A.map,O++,Z.updateMatrices(A),A.castShadow&&T++),n.spotLightMatrix[_]=Z.matrix,A.castShadow){const H=e.get(A);H.shadowIntensity=Z.intensity,H.shadowBias=Z.bias,H.shadowNormalBias=Z.normalBias,H.shadowRadius=Z.radius,H.shadowMapSize=Z.mapSize,n.spotShadow[_]=H,n.spotShadowMap[_]=W,S++}_++}else if(A.isRectAreaLight){const G=t.get(A);G.color.copy(V).multiplyScalar(z),G.halfWidth.set(A.width*.5,0,0),G.halfHeight.set(0,A.height*.5,0),n.rectArea[m]=G,m++}else if(A.isPointLight){const G=t.get(A);if(G.color.copy(A.color).multiplyScalar(A.intensity),G.distance=A.distance,G.decay=A.decay,A.castShadow){const Z=A.shadow,H=e.get(A);H.shadowIntensity=Z.intensity,H.shadowBias=Z.bias,H.shadowNormalBias=Z.normalBias,H.shadowRadius=Z.radius,H.shadowMapSize=Z.mapSize,H.shadowCameraNear=Z.camera.near,H.shadowCameraFar=Z.camera.far,n.pointShadow[g]=H,n.pointShadowMap[g]=W,n.pointShadowMatrix[g]=A.shadow.matrix,y++}n.point[g]=G,g++}else if(A.isHemisphereLight){const G=t.get(A);G.skyColor.copy(A.color).multiplyScalar(z),G.groundColor.copy(A.groundColor).multiplyScalar(z),n.hemi[d]=G,d++}}m>0&&(i.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=ct.LTC_FLOAT_1,n.rectAreaLTC2=ct.LTC_FLOAT_2):(n.rectAreaLTC1=ct.LTC_HALF_1,n.rectAreaLTC2=ct.LTC_HALF_2)),n.ambient[0]=f,n.ambient[1]=h,n.ambient[2]=u;const I=n.hash;(I.directionalLength!==p||I.pointLength!==g||I.spotLength!==_||I.rectAreaLength!==m||I.hemiLength!==d||I.numDirectionalShadows!==E||I.numPointShadows!==y||I.numSpotShadows!==S||I.numSpotMaps!==O||I.numLightProbes!==R)&&(n.directional.length=p,n.spot.length=_,n.rectArea.length=m,n.point.length=g,n.hemi.length=d,n.directionalShadow.length=E,n.directionalShadowMap.length=E,n.pointShadow.length=y,n.pointShadowMap.length=y,n.spotShadow.length=S,n.spotShadowMap.length=S,n.directionalShadowMatrix.length=E,n.pointShadowMatrix.length=y,n.spotLightMatrix.length=S+O-T,n.spotLightMap.length=O,n.numSpotLightShadowsWithMaps=T,n.numLightProbes=R,I.directionalLength=p,I.pointLength=g,I.spotLength=_,I.rectAreaLength=m,I.hemiLength=d,I.numDirectionalShadows=E,I.numPointShadows=y,I.numSpotShadows=S,I.numSpotMaps=O,I.numLightProbes=R,n.version=yg++)}function l(c,f){let h=0,u=0,p=0,g=0,_=0;const m=f.matrixWorldInverse;for(let d=0,E=c.length;d<E;d++){const y=c[d];if(y.isDirectionalLight){const S=n.directional[h];S.direction.setFromMatrixPosition(y.matrixWorld),s.setFromMatrixPosition(y.target.matrixWorld),S.direction.sub(s),S.direction.transformDirection(m),h++}else if(y.isSpotLight){const S=n.spot[p];S.position.setFromMatrixPosition(y.matrixWorld),S.position.applyMatrix4(m),S.direction.setFromMatrixPosition(y.matrixWorld),s.setFromMatrixPosition(y.target.matrixWorld),S.direction.sub(s),S.direction.transformDirection(m),p++}else if(y.isRectAreaLight){const S=n.rectArea[g];S.position.setFromMatrixPosition(y.matrixWorld),S.position.applyMatrix4(m),a.identity(),r.copy(y.matrixWorld),r.premultiply(m),a.extractRotation(r),S.halfWidth.set(y.width*.5,0,0),S.halfHeight.set(0,y.height*.5,0),S.halfWidth.applyMatrix4(a),S.halfHeight.applyMatrix4(a),g++}else if(y.isPointLight){const S=n.point[u];S.position.setFromMatrixPosition(y.matrixWorld),S.position.applyMatrix4(m),u++}else if(y.isHemisphereLight){const S=n.hemi[_];S.direction.setFromMatrixPosition(y.matrixWorld),S.direction.transformDirection(m),_++}}}return{setup:o,setupView:l,state:n}}function Jc(i){const t=new Eg(i),e=[],n=[];function s(f){c.camera=f,e.length=0,n.length=0}function r(f){e.push(f)}function a(f){n.push(f)}function o(){t.setup(e)}function l(f){t.setupView(e,f)}const c={lightsArray:e,shadowsArray:n,camera:null,lights:t,transmissionRenderTarget:{}};return{init:s,state:c,setupLights:o,setupLightsView:l,pushLight:r,pushShadow:a}}function wg(i){let t=new WeakMap;function e(s,r=0){const a=t.get(s);let o;return a===void 0?(o=new Jc(i),t.set(s,[o])):r>=a.length?(o=new Jc(i),a.push(o)):o=a[r],o}function n(){t=new WeakMap}return{get:e,dispose:n}}class Tg extends fs{static get type(){return"MeshDepthMaterial"}constructor(t){super(),this.isMeshDepthMaterial=!0,this.depthPacking=ou,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(t)}copy(t){return super.copy(t),this.depthPacking=t.depthPacking,this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this}}class Ag extends fs{static get type(){return"MeshDistanceMaterial"}constructor(t){super(),this.isMeshDistanceMaterial=!0,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(t)}copy(t){return super.copy(t),this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this}}const Rg=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Cg=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`;function Pg(i,t,e){let n=new Yl;const s=new Yt,r=new Yt,a=new Re,o=new Tg({depthPacking:lu}),l=new Ag,c={},f=e.maxTextureSize,h={[Ii]:vn,[vn]:Ii,[Ln]:Ln},u=new gi({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new Yt},radius:{value:4}},vertexShader:Rg,fragmentShader:Cg}),p=u.clone();p.defines.HORIZONTAL_PASS=1;const g=new Ge;g.setAttribute("position",new mn(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const _=new Rt(g,u),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Ih;let d=this.type;this.render=function(T,R,I){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||T.length===0)return;const b=i.getRenderTarget(),M=i.getActiveCubeFace(),A=i.getActiveMipmapLevel(),V=i.state;V.setBlending(Di),V.buffers.color.setClear(1,1,1,1),V.buffers.depth.setTest(!0),V.setScissorTest(!1);const z=d!==li&&this.type===li,C=d===li&&this.type!==li;for(let W=0,G=T.length;W<G;W++){const Z=T[W],H=Z.shadow;if(H===void 0){console.warn("THREE.WebGLShadowMap:",Z,"has no shadow.");continue}if(H.autoUpdate===!1&&H.needsUpdate===!1)continue;s.copy(H.mapSize);const it=H.getFrameExtents();if(s.multiply(it),r.copy(H.mapSize),(s.x>f||s.y>f)&&(s.x>f&&(r.x=Math.floor(f/it.x),s.x=r.x*it.x,H.mapSize.x=r.x),s.y>f&&(r.y=Math.floor(f/it.y),s.y=r.y*it.y,H.mapSize.y=r.y)),H.map===null||z===!0||C===!0){const gt=this.type!==li?{minFilter:Ne,magFilter:Ne}:{};H.map!==null&&H.map.dispose(),H.map=new Ui(s.x,s.y,gt),H.map.texture.name=Z.name+".shadowMap",H.camera.updateProjectionMatrix()}i.setRenderTarget(H.map),i.clear();const ot=H.getViewportCount();for(let gt=0;gt<ot;gt++){const Ct=H.getViewport(gt);a.set(r.x*Ct.x,r.y*Ct.y,r.x*Ct.z,r.y*Ct.w),V.viewport(a),H.updateMatrices(Z,gt),n=H.getFrustum(),S(R,I,H.camera,Z,this.type)}H.isPointLightShadow!==!0&&this.type===li&&E(H,I),H.needsUpdate=!1}d=this.type,m.needsUpdate=!1,i.setRenderTarget(b,M,A)};function E(T,R){const I=t.update(_);u.defines.VSM_SAMPLES!==T.blurSamples&&(u.defines.VSM_SAMPLES=T.blurSamples,p.defines.VSM_SAMPLES=T.blurSamples,u.needsUpdate=!0,p.needsUpdate=!0),T.mapPass===null&&(T.mapPass=new Ui(s.x,s.y)),u.uniforms.shadow_pass.value=T.map.texture,u.uniforms.resolution.value=T.mapSize,u.uniforms.radius.value=T.radius,i.setRenderTarget(T.mapPass),i.clear(),i.renderBufferDirect(R,null,I,u,_,null),p.uniforms.shadow_pass.value=T.mapPass.texture,p.uniforms.resolution.value=T.mapSize,p.uniforms.radius.value=T.radius,i.setRenderTarget(T.map),i.clear(),i.renderBufferDirect(R,null,I,p,_,null)}function y(T,R,I,b){let M=null;const A=I.isPointLight===!0?T.customDistanceMaterial:T.customDepthMaterial;if(A!==void 0)M=A;else if(M=I.isPointLight===!0?l:o,i.localClippingEnabled&&R.clipShadows===!0&&Array.isArray(R.clippingPlanes)&&R.clippingPlanes.length!==0||R.displacementMap&&R.displacementScale!==0||R.alphaMap&&R.alphaTest>0||R.map&&R.alphaTest>0){const V=M.uuid,z=R.uuid;let C=c[V];C===void 0&&(C={},c[V]=C);let W=C[z];W===void 0&&(W=M.clone(),C[z]=W,R.addEventListener("dispose",O)),M=W}if(M.visible=R.visible,M.wireframe=R.wireframe,b===li?M.side=R.shadowSide!==null?R.shadowSide:R.side:M.side=R.shadowSide!==null?R.shadowSide:h[R.side],M.alphaMap=R.alphaMap,M.alphaTest=R.alphaTest,M.map=R.map,M.clipShadows=R.clipShadows,M.clippingPlanes=R.clippingPlanes,M.clipIntersection=R.clipIntersection,M.displacementMap=R.displacementMap,M.displacementScale=R.displacementScale,M.displacementBias=R.displacementBias,M.wireframeLinewidth=R.wireframeLinewidth,M.linewidth=R.linewidth,I.isPointLight===!0&&M.isMeshDistanceMaterial===!0){const V=i.properties.get(M);V.light=I}return M}function S(T,R,I,b,M){if(T.visible===!1)return;if(T.layers.test(R.layers)&&(T.isMesh||T.isLine||T.isPoints)&&(T.castShadow||T.receiveShadow&&M===li)&&(!T.frustumCulled||n.intersectsObject(T))){T.modelViewMatrix.multiplyMatrices(I.matrixWorldInverse,T.matrixWorld);const z=t.update(T),C=T.material;if(Array.isArray(C)){const W=z.groups;for(let G=0,Z=W.length;G<Z;G++){const H=W[G],it=C[H.materialIndex];if(it&&it.visible){const ot=y(T,it,b,M);T.onBeforeShadow(i,T,R,I,z,ot,H),i.renderBufferDirect(I,null,z,ot,T,H),T.onAfterShadow(i,T,R,I,z,ot,H)}}}else if(C.visible){const W=y(T,C,b,M);T.onBeforeShadow(i,T,R,I,z,W,null),i.renderBufferDirect(I,null,z,W,T,null),T.onAfterShadow(i,T,R,I,z,W,null)}}const V=T.children;for(let z=0,C=V.length;z<C;z++)S(V[z],R,I,b,M)}function O(T){T.target.removeEventListener("dispose",O);for(const I in c){const b=c[I],M=T.target.uuid;M in b&&(b[M].dispose(),delete b[M])}}}const Lg={[zo]:ko,[Ho]:Wo,[Go]:Xo,[Js]:Vo,[ko]:zo,[Wo]:Ho,[Xo]:Go,[Vo]:Js};function Dg(i,t){function e(){let L=!1;const lt=new Re;let X=null;const j=new Re(0,0,0,0);return{setMask:function(dt){X!==dt&&!L&&(i.colorMask(dt,dt,dt,dt),X=dt)},setLocked:function(dt){L=dt},setClear:function(dt,at,Ft,ye,Vt){Vt===!0&&(dt*=ye,at*=ye,Ft*=ye),lt.set(dt,at,Ft,ye),j.equals(lt)===!1&&(i.clearColor(dt,at,Ft,ye),j.copy(lt))},reset:function(){L=!1,X=null,j.set(-1,0,0,0)}}}function n(){let L=!1,lt=!1,X=null,j=null,dt=null;return{setReversed:function(at){if(lt!==at){const Ft=t.get("EXT_clip_control");lt?Ft.clipControlEXT(Ft.LOWER_LEFT_EXT,Ft.ZERO_TO_ONE_EXT):Ft.clipControlEXT(Ft.LOWER_LEFT_EXT,Ft.NEGATIVE_ONE_TO_ONE_EXT);const ye=dt;dt=null,this.setClear(ye)}lt=at},getReversed:function(){return lt},setTest:function(at){at?st(i.DEPTH_TEST):Lt(i.DEPTH_TEST)},setMask:function(at){X!==at&&!L&&(i.depthMask(at),X=at)},setFunc:function(at){if(lt&&(at=Lg[at]),j!==at){switch(at){case zo:i.depthFunc(i.NEVER);break;case ko:i.depthFunc(i.ALWAYS);break;case Ho:i.depthFunc(i.LESS);break;case Js:i.depthFunc(i.LEQUAL);break;case Go:i.depthFunc(i.EQUAL);break;case Vo:i.depthFunc(i.GEQUAL);break;case Wo:i.depthFunc(i.GREATER);break;case Xo:i.depthFunc(i.NOTEQUAL);break;default:i.depthFunc(i.LEQUAL)}j=at}},setLocked:function(at){L=at},setClear:function(at){dt!==at&&(lt&&(at=1-at),i.clearDepth(at),dt=at)},reset:function(){L=!1,X=null,j=null,dt=null,lt=!1}}}function s(){let L=!1,lt=null,X=null,j=null,dt=null,at=null,Ft=null,ye=null,Vt=null;return{setTest:function(ie){L||(ie?st(i.STENCIL_TEST):Lt(i.STENCIL_TEST))},setMask:function(ie){lt!==ie&&!L&&(i.stencilMask(ie),lt=ie)},setFunc:function(ie,en,Pe){(X!==ie||j!==en||dt!==Pe)&&(i.stencilFunc(ie,en,Pe),X=ie,j=en,dt=Pe)},setOp:function(ie,en,Pe){(at!==ie||Ft!==en||ye!==Pe)&&(i.stencilOp(ie,en,Pe),at=ie,Ft=en,ye=Pe)},setLocked:function(ie){L=ie},setClear:function(ie){Vt!==ie&&(i.clearStencil(ie),Vt=ie)},reset:function(){L=!1,lt=null,X=null,j=null,dt=null,at=null,Ft=null,ye=null,Vt=null}}}const r=new e,a=new n,o=new s,l=new WeakMap,c=new WeakMap;let f={},h={},u=new WeakMap,p=[],g=null,_=!1,m=null,d=null,E=null,y=null,S=null,O=null,T=null,R=new Tt(0,0,0),I=0,b=!1,M=null,A=null,V=null,z=null,C=null;const W=i.getParameter(i.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let G=!1,Z=0;const H=i.getParameter(i.VERSION);H.indexOf("WebGL")!==-1?(Z=parseFloat(/^WebGL (\d)/.exec(H)[1]),G=Z>=1):H.indexOf("OpenGL ES")!==-1&&(Z=parseFloat(/^OpenGL ES (\d)/.exec(H)[1]),G=Z>=2);let it=null,ot={};const gt=i.getParameter(i.SCISSOR_BOX),Ct=i.getParameter(i.VIEWPORT),Jt=new Re().fromArray(gt),Y=new Re().fromArray(Ct);function tt(L,lt,X,j){const dt=new Uint8Array(4),at=i.createTexture();i.bindTexture(L,at),i.texParameteri(L,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(L,i.TEXTURE_MAG_FILTER,i.NEAREST);for(let Ft=0;Ft<X;Ft++)L===i.TEXTURE_3D||L===i.TEXTURE_2D_ARRAY?i.texImage3D(lt,0,i.RGBA,1,1,j,0,i.RGBA,i.UNSIGNED_BYTE,dt):i.texImage2D(lt+Ft,0,i.RGBA,1,1,0,i.RGBA,i.UNSIGNED_BYTE,dt);return at}const _t={};_t[i.TEXTURE_2D]=tt(i.TEXTURE_2D,i.TEXTURE_2D,1),_t[i.TEXTURE_CUBE_MAP]=tt(i.TEXTURE_CUBE_MAP,i.TEXTURE_CUBE_MAP_POSITIVE_X,6),_t[i.TEXTURE_2D_ARRAY]=tt(i.TEXTURE_2D_ARRAY,i.TEXTURE_2D_ARRAY,1,1),_t[i.TEXTURE_3D]=tt(i.TEXTURE_3D,i.TEXTURE_3D,1,1),r.setClear(0,0,0,1),a.setClear(1),o.setClear(0),st(i.DEPTH_TEST),a.setFunc(Js),Gt(!1),$t(ic),st(i.CULL_FACE),U(Di);function st(L){f[L]!==!0&&(i.enable(L),f[L]=!0)}function Lt(L){f[L]!==!1&&(i.disable(L),f[L]=!1)}function It(L,lt){return h[L]!==lt?(i.bindFramebuffer(L,lt),h[L]=lt,L===i.DRAW_FRAMEBUFFER&&(h[i.FRAMEBUFFER]=lt),L===i.FRAMEBUFFER&&(h[i.DRAW_FRAMEBUFFER]=lt),!0):!1}function zt(L,lt){let X=p,j=!1;if(L){X=u.get(lt),X===void 0&&(X=[],u.set(lt,X));const dt=L.textures;if(X.length!==dt.length||X[0]!==i.COLOR_ATTACHMENT0){for(let at=0,Ft=dt.length;at<Ft;at++)X[at]=i.COLOR_ATTACHMENT0+at;X.length=dt.length,j=!0}}else X[0]!==i.BACK&&(X[0]=i.BACK,j=!0);j&&i.drawBuffers(X)}function _e(L){return g!==L?(i.useProgram(L),g=L,!0):!1}const qt={[Ji]:i.FUNC_ADD,[Uf]:i.FUNC_SUBTRACT,[Nf]:i.FUNC_REVERSE_SUBTRACT};qt[Ff]=i.MIN,qt[Of]=i.MAX;const Se={[Bf]:i.ZERO,[zf]:i.ONE,[kf]:i.SRC_COLOR,[Oo]:i.SRC_ALPHA,[Yf]:i.SRC_ALPHA_SATURATE,[Wf]:i.DST_COLOR,[Gf]:i.DST_ALPHA,[Hf]:i.ONE_MINUS_SRC_COLOR,[Bo]:i.ONE_MINUS_SRC_ALPHA,[Xf]:i.ONE_MINUS_DST_COLOR,[Vf]:i.ONE_MINUS_DST_ALPHA,[qf]:i.CONSTANT_COLOR,[Zf]:i.ONE_MINUS_CONSTANT_COLOR,[Kf]:i.CONSTANT_ALPHA,[$f]:i.ONE_MINUS_CONSTANT_ALPHA};function U(L,lt,X,j,dt,at,Ft,ye,Vt,ie){if(L===Di){_===!0&&(Lt(i.BLEND),_=!1);return}if(_===!1&&(st(i.BLEND),_=!0),L!==If){if(L!==m||ie!==b){if((d!==Ji||S!==Ji)&&(i.blendEquation(i.FUNC_ADD),d=Ji,S=Ji),ie)switch(L){case Zs:i.blendFuncSeparate(i.ONE,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case $n:i.blendFunc(i.ONE,i.ONE);break;case sc:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case rc:i.blendFuncSeparate(i.ZERO,i.SRC_COLOR,i.ZERO,i.SRC_ALPHA);break;default:console.error("THREE.WebGLState: Invalid blending: ",L);break}else switch(L){case Zs:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case $n:i.blendFunc(i.SRC_ALPHA,i.ONE);break;case sc:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case rc:i.blendFunc(i.ZERO,i.SRC_COLOR);break;default:console.error("THREE.WebGLState: Invalid blending: ",L);break}E=null,y=null,O=null,T=null,R.set(0,0,0),I=0,m=L,b=ie}return}dt=dt||lt,at=at||X,Ft=Ft||j,(lt!==d||dt!==S)&&(i.blendEquationSeparate(qt[lt],qt[dt]),d=lt,S=dt),(X!==E||j!==y||at!==O||Ft!==T)&&(i.blendFuncSeparate(Se[X],Se[j],Se[at],Se[Ft]),E=X,y=j,O=at,T=Ft),(ye.equals(R)===!1||Vt!==I)&&(i.blendColor(ye.r,ye.g,ye.b,Vt),R.copy(ye),I=Vt),m=L,b=!1}function Ze(L,lt){L.side===Ln?Lt(i.CULL_FACE):st(i.CULL_FACE);let X=L.side===vn;lt&&(X=!X),Gt(X),L.blending===Zs&&L.transparent===!1?U(Di):U(L.blending,L.blendEquation,L.blendSrc,L.blendDst,L.blendEquationAlpha,L.blendSrcAlpha,L.blendDstAlpha,L.blendColor,L.blendAlpha,L.premultipliedAlpha),a.setFunc(L.depthFunc),a.setTest(L.depthTest),a.setMask(L.depthWrite),r.setMask(L.colorWrite);const j=L.stencilWrite;o.setTest(j),j&&(o.setMask(L.stencilWriteMask),o.setFunc(L.stencilFunc,L.stencilRef,L.stencilFuncMask),o.setOp(L.stencilFail,L.stencilZFail,L.stencilZPass)),oe(L.polygonOffset,L.polygonOffsetFactor,L.polygonOffsetUnits),L.alphaToCoverage===!0?st(i.SAMPLE_ALPHA_TO_COVERAGE):Lt(i.SAMPLE_ALPHA_TO_COVERAGE)}function Gt(L){M!==L&&(L?i.frontFace(i.CW):i.frontFace(i.CCW),M=L)}function $t(L){L!==Lf?(st(i.CULL_FACE),L!==A&&(L===ic?i.cullFace(i.BACK):L===Df?i.cullFace(i.FRONT):i.cullFace(i.FRONT_AND_BACK))):Lt(i.CULL_FACE),A=L}function Et(L){L!==V&&(G&&i.lineWidth(L),V=L)}function oe(L,lt,X){L?(st(i.POLYGON_OFFSET_FILL),(z!==lt||C!==X)&&(i.polygonOffset(lt,X),z=lt,C=X)):Lt(i.POLYGON_OFFSET_FILL)}function At(L){L?st(i.SCISSOR_TEST):Lt(i.SCISSOR_TEST)}function w(L){L===void 0&&(L=i.TEXTURE0+W-1),it!==L&&(i.activeTexture(L),it=L)}function x(L,lt,X){X===void 0&&(it===null?X=i.TEXTURE0+W-1:X=it);let j=ot[X];j===void 0&&(j={type:void 0,texture:void 0},ot[X]=j),(j.type!==L||j.texture!==lt)&&(it!==X&&(i.activeTexture(X),it=X),i.bindTexture(L,lt||_t[L]),j.type=L,j.texture=lt)}function B(){const L=ot[it];L!==void 0&&L.type!==void 0&&(i.bindTexture(L.type,null),L.type=void 0,L.texture=void 0)}function $(){try{i.compressedTexImage2D.apply(i,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function J(){try{i.compressedTexImage3D.apply(i,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function K(){try{i.texSubImage2D.apply(i,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function xt(){try{i.texSubImage3D.apply(i,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function rt(){try{i.compressedTexSubImage2D.apply(i,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function pt(){try{i.compressedTexSubImage3D.apply(i,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function Zt(){try{i.texStorage2D.apply(i,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function Q(){try{i.texStorage3D.apply(i,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function mt(){try{i.texImage2D.apply(i,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function Dt(){try{i.texImage3D.apply(i,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function ht(L){Jt.equals(L)===!1&&(i.scissor(L.x,L.y,L.z,L.w),Jt.copy(L))}function ut(L){Y.equals(L)===!1&&(i.viewport(L.x,L.y,L.z,L.w),Y.copy(L))}function jt(L,lt){let X=c.get(lt);X===void 0&&(X=new WeakMap,c.set(lt,X));let j=X.get(L);j===void 0&&(j=i.getUniformBlockIndex(lt,L.name),X.set(L,j))}function Ut(L,lt){const j=c.get(lt).get(L);l.get(lt)!==j&&(i.uniformBlockBinding(lt,j,L.__bindingPointIndex),l.set(lt,j))}function Pt(){i.disable(i.BLEND),i.disable(i.CULL_FACE),i.disable(i.DEPTH_TEST),i.disable(i.POLYGON_OFFSET_FILL),i.disable(i.SCISSOR_TEST),i.disable(i.STENCIL_TEST),i.disable(i.SAMPLE_ALPHA_TO_COVERAGE),i.blendEquation(i.FUNC_ADD),i.blendFunc(i.ONE,i.ZERO),i.blendFuncSeparate(i.ONE,i.ZERO,i.ONE,i.ZERO),i.blendColor(0,0,0,0),i.colorMask(!0,!0,!0,!0),i.clearColor(0,0,0,0),i.depthMask(!0),i.depthFunc(i.LESS),a.setReversed(!1),i.clearDepth(1),i.stencilMask(4294967295),i.stencilFunc(i.ALWAYS,0,4294967295),i.stencilOp(i.KEEP,i.KEEP,i.KEEP),i.clearStencil(0),i.cullFace(i.BACK),i.frontFace(i.CCW),i.polygonOffset(0,0),i.activeTexture(i.TEXTURE0),i.bindFramebuffer(i.FRAMEBUFFER,null),i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),i.bindFramebuffer(i.READ_FRAMEBUFFER,null),i.useProgram(null),i.lineWidth(1),i.scissor(0,0,i.canvas.width,i.canvas.height),i.viewport(0,0,i.canvas.width,i.canvas.height),f={},it=null,ot={},h={},u=new WeakMap,p=[],g=null,_=!1,m=null,d=null,E=null,y=null,S=null,O=null,T=null,R=new Tt(0,0,0),I=0,b=!1,M=null,A=null,V=null,z=null,C=null,Jt.set(0,0,i.canvas.width,i.canvas.height),Y.set(0,0,i.canvas.width,i.canvas.height),r.reset(),a.reset(),o.reset()}return{buffers:{color:r,depth:a,stencil:o},enable:st,disable:Lt,bindFramebuffer:It,drawBuffers:zt,useProgram:_e,setBlending:U,setMaterial:Ze,setFlipSided:Gt,setCullFace:$t,setLineWidth:Et,setPolygonOffset:oe,setScissorTest:At,activeTexture:w,bindTexture:x,unbindTexture:B,compressedTexImage2D:$,compressedTexImage3D:J,texImage2D:mt,texImage3D:Dt,updateUBOMapping:jt,uniformBlockBinding:Ut,texStorage2D:Zt,texStorage3D:Q,texSubImage2D:K,texSubImage3D:xt,compressedTexSubImage2D:rt,compressedTexSubImage3D:pt,scissor:ht,viewport:ut,reset:Pt}}function Qc(i,t,e,n){const s=Ig(n);switch(e){case zh:return i*t;case Hh:return i*t;case Gh:return i*t*2;case zl:return i*t/s.components*s.byteLength;case kl:return i*t/s.components*s.byteLength;case Vh:return i*t*2/s.components*s.byteLength;case Hl:return i*t*2/s.components*s.byteLength;case kh:return i*t*3/s.components*s.byteLength;case Hn:return i*t*4/s.components*s.byteLength;case Gl:return i*t*4/s.components*s.byteLength;case Ra:case Ca:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*8;case Pa:case La:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case jo:case Qo:return Math.max(i,16)*Math.max(t,8)/4;case $o:case Jo:return Math.max(i,8)*Math.max(t,8)/2;case tl:case el:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*8;case nl:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case il:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case sl:return Math.floor((i+4)/5)*Math.floor((t+3)/4)*16;case rl:return Math.floor((i+4)/5)*Math.floor((t+4)/5)*16;case al:return Math.floor((i+5)/6)*Math.floor((t+4)/5)*16;case ol:return Math.floor((i+5)/6)*Math.floor((t+5)/6)*16;case ll:return Math.floor((i+7)/8)*Math.floor((t+4)/5)*16;case cl:return Math.floor((i+7)/8)*Math.floor((t+5)/6)*16;case hl:return Math.floor((i+7)/8)*Math.floor((t+7)/8)*16;case fl:return Math.floor((i+9)/10)*Math.floor((t+4)/5)*16;case ul:return Math.floor((i+9)/10)*Math.floor((t+5)/6)*16;case dl:return Math.floor((i+9)/10)*Math.floor((t+7)/8)*16;case pl:return Math.floor((i+9)/10)*Math.floor((t+9)/10)*16;case ml:return Math.floor((i+11)/12)*Math.floor((t+9)/10)*16;case gl:return Math.floor((i+11)/12)*Math.floor((t+11)/12)*16;case Da:case _l:case xl:return Math.ceil(i/4)*Math.ceil(t/4)*16;case Wh:case vl:return Math.ceil(i/4)*Math.ceil(t/4)*8;case Ml:case Sl:return Math.ceil(i/4)*Math.ceil(t/4)*16}throw new Error(`Unable to determine texture byte length for ${e} format.`)}function Ig(i){switch(i){case jn:case Fh:return{byteLength:1,components:1};case Br:case Oh:case ar:return{byteLength:2,components:1};case Ol:case Bl:return{byteLength:2,components:4};case ss:case Fl:case qn:return{byteLength:4,components:1};case Bh:return{byteLength:4,components:3}}throw new Error(`Unknown texture type ${i}.`)}function Ug(i,t,e,n,s,r,a){const o=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new Yt,f=new WeakMap;let h;const u=new WeakMap;let p=!1;try{p=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function g(w,x){return p?new OffscreenCanvas(w,x):Ba("canvas")}function _(w,x,B){let $=1;const J=At(w);if((J.width>B||J.height>B)&&($=B/Math.max(J.width,J.height)),$<1)if(typeof HTMLImageElement<"u"&&w instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&w instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&w instanceof ImageBitmap||typeof VideoFrame<"u"&&w instanceof VideoFrame){const K=Math.floor($*J.width),xt=Math.floor($*J.height);h===void 0&&(h=g(K,xt));const rt=x?g(K,xt):h;return rt.width=K,rt.height=xt,rt.getContext("2d").drawImage(w,0,0,K,xt),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+J.width+"x"+J.height+") to ("+K+"x"+xt+")."),rt}else return"data"in w&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+J.width+"x"+J.height+")."),w;return w}function m(w){return w.generateMipmaps}function d(w){i.generateMipmap(w)}function E(w){return w.isWebGLCubeRenderTarget?i.TEXTURE_CUBE_MAP:w.isWebGL3DRenderTarget?i.TEXTURE_3D:w.isWebGLArrayRenderTarget||w.isCompressedArrayTexture?i.TEXTURE_2D_ARRAY:i.TEXTURE_2D}function y(w,x,B,$,J=!1){if(w!==null){if(i[w]!==void 0)return i[w];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+w+"'")}let K=x;if(x===i.RED&&(B===i.FLOAT&&(K=i.R32F),B===i.HALF_FLOAT&&(K=i.R16F),B===i.UNSIGNED_BYTE&&(K=i.R8)),x===i.RED_INTEGER&&(B===i.UNSIGNED_BYTE&&(K=i.R8UI),B===i.UNSIGNED_SHORT&&(K=i.R16UI),B===i.UNSIGNED_INT&&(K=i.R32UI),B===i.BYTE&&(K=i.R8I),B===i.SHORT&&(K=i.R16I),B===i.INT&&(K=i.R32I)),x===i.RG&&(B===i.FLOAT&&(K=i.RG32F),B===i.HALF_FLOAT&&(K=i.RG16F),B===i.UNSIGNED_BYTE&&(K=i.RG8)),x===i.RG_INTEGER&&(B===i.UNSIGNED_BYTE&&(K=i.RG8UI),B===i.UNSIGNED_SHORT&&(K=i.RG16UI),B===i.UNSIGNED_INT&&(K=i.RG32UI),B===i.BYTE&&(K=i.RG8I),B===i.SHORT&&(K=i.RG16I),B===i.INT&&(K=i.RG32I)),x===i.RGB_INTEGER&&(B===i.UNSIGNED_BYTE&&(K=i.RGB8UI),B===i.UNSIGNED_SHORT&&(K=i.RGB16UI),B===i.UNSIGNED_INT&&(K=i.RGB32UI),B===i.BYTE&&(K=i.RGB8I),B===i.SHORT&&(K=i.RGB16I),B===i.INT&&(K=i.RGB32I)),x===i.RGBA_INTEGER&&(B===i.UNSIGNED_BYTE&&(K=i.RGBA8UI),B===i.UNSIGNED_SHORT&&(K=i.RGBA16UI),B===i.UNSIGNED_INT&&(K=i.RGBA32UI),B===i.BYTE&&(K=i.RGBA8I),B===i.SHORT&&(K=i.RGBA16I),B===i.INT&&(K=i.RGBA32I)),x===i.RGB&&B===i.UNSIGNED_INT_5_9_9_9_REV&&(K=i.RGB9_E5),x===i.RGBA){const xt=J?Wa:ae.getTransfer($);B===i.FLOAT&&(K=i.RGBA32F),B===i.HALF_FLOAT&&(K=i.RGBA16F),B===i.UNSIGNED_BYTE&&(K=xt===ge?i.SRGB8_ALPHA8:i.RGBA8),B===i.UNSIGNED_SHORT_4_4_4_4&&(K=i.RGBA4),B===i.UNSIGNED_SHORT_5_5_5_1&&(K=i.RGB5_A1)}return(K===i.R16F||K===i.R32F||K===i.RG16F||K===i.RG32F||K===i.RGBA16F||K===i.RGBA32F)&&t.get("EXT_color_buffer_float"),K}function S(w,x){let B;return w?x===null||x===ss||x===er?B=i.DEPTH24_STENCIL8:x===qn?B=i.DEPTH32F_STENCIL8:x===Br&&(B=i.DEPTH24_STENCIL8,console.warn("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):x===null||x===ss||x===er?B=i.DEPTH_COMPONENT24:x===qn?B=i.DEPTH_COMPONENT32F:x===Br&&(B=i.DEPTH_COMPONENT16),B}function O(w,x){return m(w)===!0||w.isFramebufferTexture&&w.minFilter!==Ne&&w.minFilter!==Yn?Math.log2(Math.max(x.width,x.height))+1:w.mipmaps!==void 0&&w.mipmaps.length>0?w.mipmaps.length:w.isCompressedTexture&&Array.isArray(w.image)?x.mipmaps.length:1}function T(w){const x=w.target;x.removeEventListener("dispose",T),I(x),x.isVideoTexture&&f.delete(x)}function R(w){const x=w.target;x.removeEventListener("dispose",R),M(x)}function I(w){const x=n.get(w);if(x.__webglInit===void 0)return;const B=w.source,$=u.get(B);if($){const J=$[x.__cacheKey];J.usedTimes--,J.usedTimes===0&&b(w),Object.keys($).length===0&&u.delete(B)}n.remove(w)}function b(w){const x=n.get(w);i.deleteTexture(x.__webglTexture);const B=w.source,$=u.get(B);delete $[x.__cacheKey],a.memory.textures--}function M(w){const x=n.get(w);if(w.depthTexture&&(w.depthTexture.dispose(),n.remove(w.depthTexture)),w.isWebGLCubeRenderTarget)for(let $=0;$<6;$++){if(Array.isArray(x.__webglFramebuffer[$]))for(let J=0;J<x.__webglFramebuffer[$].length;J++)i.deleteFramebuffer(x.__webglFramebuffer[$][J]);else i.deleteFramebuffer(x.__webglFramebuffer[$]);x.__webglDepthbuffer&&i.deleteRenderbuffer(x.__webglDepthbuffer[$])}else{if(Array.isArray(x.__webglFramebuffer))for(let $=0;$<x.__webglFramebuffer.length;$++)i.deleteFramebuffer(x.__webglFramebuffer[$]);else i.deleteFramebuffer(x.__webglFramebuffer);if(x.__webglDepthbuffer&&i.deleteRenderbuffer(x.__webglDepthbuffer),x.__webglMultisampledFramebuffer&&i.deleteFramebuffer(x.__webglMultisampledFramebuffer),x.__webglColorRenderbuffer)for(let $=0;$<x.__webglColorRenderbuffer.length;$++)x.__webglColorRenderbuffer[$]&&i.deleteRenderbuffer(x.__webglColorRenderbuffer[$]);x.__webglDepthRenderbuffer&&i.deleteRenderbuffer(x.__webglDepthRenderbuffer)}const B=w.textures;for(let $=0,J=B.length;$<J;$++){const K=n.get(B[$]);K.__webglTexture&&(i.deleteTexture(K.__webglTexture),a.memory.textures--),n.remove(B[$])}n.remove(w)}let A=0;function V(){A=0}function z(){const w=A;return w>=s.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+w+" texture units while this GPU supports only "+s.maxTextures),A+=1,w}function C(w){const x=[];return x.push(w.wrapS),x.push(w.wrapT),x.push(w.wrapR||0),x.push(w.magFilter),x.push(w.minFilter),x.push(w.anisotropy),x.push(w.internalFormat),x.push(w.format),x.push(w.type),x.push(w.generateMipmaps),x.push(w.premultiplyAlpha),x.push(w.flipY),x.push(w.unpackAlignment),x.push(w.colorSpace),x.join()}function W(w,x){const B=n.get(w);if(w.isVideoTexture&&Et(w),w.isRenderTargetTexture===!1&&w.version>0&&B.__version!==w.version){const $=w.image;if($===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if($.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{Y(B,w,x);return}}e.bindTexture(i.TEXTURE_2D,B.__webglTexture,i.TEXTURE0+x)}function G(w,x){const B=n.get(w);if(w.version>0&&B.__version!==w.version){Y(B,w,x);return}e.bindTexture(i.TEXTURE_2D_ARRAY,B.__webglTexture,i.TEXTURE0+x)}function Z(w,x){const B=n.get(w);if(w.version>0&&B.__version!==w.version){Y(B,w,x);return}e.bindTexture(i.TEXTURE_3D,B.__webglTexture,i.TEXTURE0+x)}function H(w,x){const B=n.get(w);if(w.version>0&&B.__version!==w.version){tt(B,w,x);return}e.bindTexture(i.TEXTURE_CUBE_MAP,B.__webglTexture,i.TEXTURE0+x)}const it={[Zo]:i.REPEAT,[ts]:i.CLAMP_TO_EDGE,[Ko]:i.MIRRORED_REPEAT},ot={[Ne]:i.NEAREST,[au]:i.NEAREST_MIPMAP_NEAREST,[Yr]:i.NEAREST_MIPMAP_LINEAR,[Yn]:i.LINEAR,[ja]:i.LINEAR_MIPMAP_NEAREST,[Pi]:i.LINEAR_MIPMAP_LINEAR},gt={[hu]:i.NEVER,[gu]:i.ALWAYS,[fu]:i.LESS,[Yh]:i.LEQUAL,[uu]:i.EQUAL,[mu]:i.GEQUAL,[du]:i.GREATER,[pu]:i.NOTEQUAL};function Ct(w,x){if(x.type===qn&&t.has("OES_texture_float_linear")===!1&&(x.magFilter===Yn||x.magFilter===ja||x.magFilter===Yr||x.magFilter===Pi||x.minFilter===Yn||x.minFilter===ja||x.minFilter===Yr||x.minFilter===Pi)&&console.warn("THREE.WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),i.texParameteri(w,i.TEXTURE_WRAP_S,it[x.wrapS]),i.texParameteri(w,i.TEXTURE_WRAP_T,it[x.wrapT]),(w===i.TEXTURE_3D||w===i.TEXTURE_2D_ARRAY)&&i.texParameteri(w,i.TEXTURE_WRAP_R,it[x.wrapR]),i.texParameteri(w,i.TEXTURE_MAG_FILTER,ot[x.magFilter]),i.texParameteri(w,i.TEXTURE_MIN_FILTER,ot[x.minFilter]),x.compareFunction&&(i.texParameteri(w,i.TEXTURE_COMPARE_MODE,i.COMPARE_REF_TO_TEXTURE),i.texParameteri(w,i.TEXTURE_COMPARE_FUNC,gt[x.compareFunction])),t.has("EXT_texture_filter_anisotropic")===!0){if(x.magFilter===Ne||x.minFilter!==Yr&&x.minFilter!==Pi||x.type===qn&&t.has("OES_texture_float_linear")===!1)return;if(x.anisotropy>1||n.get(x).__currentAnisotropy){const B=t.get("EXT_texture_filter_anisotropic");i.texParameterf(w,B.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(x.anisotropy,s.getMaxAnisotropy())),n.get(x).__currentAnisotropy=x.anisotropy}}}function Jt(w,x){let B=!1;w.__webglInit===void 0&&(w.__webglInit=!0,x.addEventListener("dispose",T));const $=x.source;let J=u.get($);J===void 0&&(J={},u.set($,J));const K=C(x);if(K!==w.__cacheKey){J[K]===void 0&&(J[K]={texture:i.createTexture(),usedTimes:0},a.memory.textures++,B=!0),J[K].usedTimes++;const xt=J[w.__cacheKey];xt!==void 0&&(J[w.__cacheKey].usedTimes--,xt.usedTimes===0&&b(x)),w.__cacheKey=K,w.__webglTexture=J[K].texture}return B}function Y(w,x,B){let $=i.TEXTURE_2D;(x.isDataArrayTexture||x.isCompressedArrayTexture)&&($=i.TEXTURE_2D_ARRAY),x.isData3DTexture&&($=i.TEXTURE_3D);const J=Jt(w,x),K=x.source;e.bindTexture($,w.__webglTexture,i.TEXTURE0+B);const xt=n.get(K);if(K.version!==xt.__version||J===!0){e.activeTexture(i.TEXTURE0+B);const rt=ae.getPrimaries(ae.workingColorSpace),pt=x.colorSpace===Ci?null:ae.getPrimaries(x.colorSpace),Zt=x.colorSpace===Ci||rt===pt?i.NONE:i.BROWSER_DEFAULT_WEBGL;i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,x.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,x.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,x.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,Zt);let Q=_(x.image,!1,s.maxTextureSize);Q=oe(x,Q);const mt=r.convert(x.format,x.colorSpace),Dt=r.convert(x.type);let ht=y(x.internalFormat,mt,Dt,x.colorSpace,x.isVideoTexture);Ct($,x);let ut;const jt=x.mipmaps,Ut=x.isVideoTexture!==!0,Pt=xt.__version===void 0||J===!0,L=K.dataReady,lt=O(x,Q);if(x.isDepthTexture)ht=S(x.format===nr,x.type),Pt&&(Ut?e.texStorage2D(i.TEXTURE_2D,1,ht,Q.width,Q.height):e.texImage2D(i.TEXTURE_2D,0,ht,Q.width,Q.height,0,mt,Dt,null));else if(x.isDataTexture)if(jt.length>0){Ut&&Pt&&e.texStorage2D(i.TEXTURE_2D,lt,ht,jt[0].width,jt[0].height);for(let X=0,j=jt.length;X<j;X++)ut=jt[X],Ut?L&&e.texSubImage2D(i.TEXTURE_2D,X,0,0,ut.width,ut.height,mt,Dt,ut.data):e.texImage2D(i.TEXTURE_2D,X,ht,ut.width,ut.height,0,mt,Dt,ut.data);x.generateMipmaps=!1}else Ut?(Pt&&e.texStorage2D(i.TEXTURE_2D,lt,ht,Q.width,Q.height),L&&e.texSubImage2D(i.TEXTURE_2D,0,0,0,Q.width,Q.height,mt,Dt,Q.data)):e.texImage2D(i.TEXTURE_2D,0,ht,Q.width,Q.height,0,mt,Dt,Q.data);else if(x.isCompressedTexture)if(x.isCompressedArrayTexture){Ut&&Pt&&e.texStorage3D(i.TEXTURE_2D_ARRAY,lt,ht,jt[0].width,jt[0].height,Q.depth);for(let X=0,j=jt.length;X<j;X++)if(ut=jt[X],x.format!==Hn)if(mt!==null)if(Ut){if(L)if(x.layerUpdates.size>0){const dt=Qc(ut.width,ut.height,x.format,x.type);for(const at of x.layerUpdates){const Ft=ut.data.subarray(at*dt/ut.data.BYTES_PER_ELEMENT,(at+1)*dt/ut.data.BYTES_PER_ELEMENT);e.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,X,0,0,at,ut.width,ut.height,1,mt,Ft)}x.clearLayerUpdates()}else e.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,X,0,0,0,ut.width,ut.height,Q.depth,mt,ut.data)}else e.compressedTexImage3D(i.TEXTURE_2D_ARRAY,X,ht,ut.width,ut.height,Q.depth,0,ut.data,0,0);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Ut?L&&e.texSubImage3D(i.TEXTURE_2D_ARRAY,X,0,0,0,ut.width,ut.height,Q.depth,mt,Dt,ut.data):e.texImage3D(i.TEXTURE_2D_ARRAY,X,ht,ut.width,ut.height,Q.depth,0,mt,Dt,ut.data)}else{Ut&&Pt&&e.texStorage2D(i.TEXTURE_2D,lt,ht,jt[0].width,jt[0].height);for(let X=0,j=jt.length;X<j;X++)ut=jt[X],x.format!==Hn?mt!==null?Ut?L&&e.compressedTexSubImage2D(i.TEXTURE_2D,X,0,0,ut.width,ut.height,mt,ut.data):e.compressedTexImage2D(i.TEXTURE_2D,X,ht,ut.width,ut.height,0,ut.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Ut?L&&e.texSubImage2D(i.TEXTURE_2D,X,0,0,ut.width,ut.height,mt,Dt,ut.data):e.texImage2D(i.TEXTURE_2D,X,ht,ut.width,ut.height,0,mt,Dt,ut.data)}else if(x.isDataArrayTexture)if(Ut){if(Pt&&e.texStorage3D(i.TEXTURE_2D_ARRAY,lt,ht,Q.width,Q.height,Q.depth),L)if(x.layerUpdates.size>0){const X=Qc(Q.width,Q.height,x.format,x.type);for(const j of x.layerUpdates){const dt=Q.data.subarray(j*X/Q.data.BYTES_PER_ELEMENT,(j+1)*X/Q.data.BYTES_PER_ELEMENT);e.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,j,Q.width,Q.height,1,mt,Dt,dt)}x.clearLayerUpdates()}else e.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,0,Q.width,Q.height,Q.depth,mt,Dt,Q.data)}else e.texImage3D(i.TEXTURE_2D_ARRAY,0,ht,Q.width,Q.height,Q.depth,0,mt,Dt,Q.data);else if(x.isData3DTexture)Ut?(Pt&&e.texStorage3D(i.TEXTURE_3D,lt,ht,Q.width,Q.height,Q.depth),L&&e.texSubImage3D(i.TEXTURE_3D,0,0,0,0,Q.width,Q.height,Q.depth,mt,Dt,Q.data)):e.texImage3D(i.TEXTURE_3D,0,ht,Q.width,Q.height,Q.depth,0,mt,Dt,Q.data);else if(x.isFramebufferTexture){if(Pt)if(Ut)e.texStorage2D(i.TEXTURE_2D,lt,ht,Q.width,Q.height);else{let X=Q.width,j=Q.height;for(let dt=0;dt<lt;dt++)e.texImage2D(i.TEXTURE_2D,dt,ht,X,j,0,mt,Dt,null),X>>=1,j>>=1}}else if(jt.length>0){if(Ut&&Pt){const X=At(jt[0]);e.texStorage2D(i.TEXTURE_2D,lt,ht,X.width,X.height)}for(let X=0,j=jt.length;X<j;X++)ut=jt[X],Ut?L&&e.texSubImage2D(i.TEXTURE_2D,X,0,0,mt,Dt,ut):e.texImage2D(i.TEXTURE_2D,X,ht,mt,Dt,ut);x.generateMipmaps=!1}else if(Ut){if(Pt){const X=At(Q);e.texStorage2D(i.TEXTURE_2D,lt,ht,X.width,X.height)}L&&e.texSubImage2D(i.TEXTURE_2D,0,0,0,mt,Dt,Q)}else e.texImage2D(i.TEXTURE_2D,0,ht,mt,Dt,Q);m(x)&&d($),xt.__version=K.version,x.onUpdate&&x.onUpdate(x)}w.__version=x.version}function tt(w,x,B){if(x.image.length!==6)return;const $=Jt(w,x),J=x.source;e.bindTexture(i.TEXTURE_CUBE_MAP,w.__webglTexture,i.TEXTURE0+B);const K=n.get(J);if(J.version!==K.__version||$===!0){e.activeTexture(i.TEXTURE0+B);const xt=ae.getPrimaries(ae.workingColorSpace),rt=x.colorSpace===Ci?null:ae.getPrimaries(x.colorSpace),pt=x.colorSpace===Ci||xt===rt?i.NONE:i.BROWSER_DEFAULT_WEBGL;i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,x.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,x.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,x.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,pt);const Zt=x.isCompressedTexture||x.image[0].isCompressedTexture,Q=x.image[0]&&x.image[0].isDataTexture,mt=[];for(let j=0;j<6;j++)!Zt&&!Q?mt[j]=_(x.image[j],!0,s.maxCubemapSize):mt[j]=Q?x.image[j].image:x.image[j],mt[j]=oe(x,mt[j]);const Dt=mt[0],ht=r.convert(x.format,x.colorSpace),ut=r.convert(x.type),jt=y(x.internalFormat,ht,ut,x.colorSpace),Ut=x.isVideoTexture!==!0,Pt=K.__version===void 0||$===!0,L=J.dataReady;let lt=O(x,Dt);Ct(i.TEXTURE_CUBE_MAP,x);let X;if(Zt){Ut&&Pt&&e.texStorage2D(i.TEXTURE_CUBE_MAP,lt,jt,Dt.width,Dt.height);for(let j=0;j<6;j++){X=mt[j].mipmaps;for(let dt=0;dt<X.length;dt++){const at=X[dt];x.format!==Hn?ht!==null?Ut?L&&e.compressedTexSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,dt,0,0,at.width,at.height,ht,at.data):e.compressedTexImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,dt,jt,at.width,at.height,0,at.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):Ut?L&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,dt,0,0,at.width,at.height,ht,ut,at.data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,dt,jt,at.width,at.height,0,ht,ut,at.data)}}}else{if(X=x.mipmaps,Ut&&Pt){X.length>0&&lt++;const j=At(mt[0]);e.texStorage2D(i.TEXTURE_CUBE_MAP,lt,jt,j.width,j.height)}for(let j=0;j<6;j++)if(Q){Ut?L&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,0,0,0,mt[j].width,mt[j].height,ht,ut,mt[j].data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,0,jt,mt[j].width,mt[j].height,0,ht,ut,mt[j].data);for(let dt=0;dt<X.length;dt++){const Ft=X[dt].image[j].image;Ut?L&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,dt+1,0,0,Ft.width,Ft.height,ht,ut,Ft.data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,dt+1,jt,Ft.width,Ft.height,0,ht,ut,Ft.data)}}else{Ut?L&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,0,0,0,ht,ut,mt[j]):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,0,jt,ht,ut,mt[j]);for(let dt=0;dt<X.length;dt++){const at=X[dt];Ut?L&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,dt+1,0,0,ht,ut,at.image[j]):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,dt+1,jt,ht,ut,at.image[j])}}}m(x)&&d(i.TEXTURE_CUBE_MAP),K.__version=J.version,x.onUpdate&&x.onUpdate(x)}w.__version=x.version}function _t(w,x,B,$,J,K){const xt=r.convert(B.format,B.colorSpace),rt=r.convert(B.type),pt=y(B.internalFormat,xt,rt,B.colorSpace),Zt=n.get(x),Q=n.get(B);if(Q.__renderTarget=x,!Zt.__hasExternalTextures){const mt=Math.max(1,x.width>>K),Dt=Math.max(1,x.height>>K);J===i.TEXTURE_3D||J===i.TEXTURE_2D_ARRAY?e.texImage3D(J,K,pt,mt,Dt,x.depth,0,xt,rt,null):e.texImage2D(J,K,pt,mt,Dt,0,xt,rt,null)}e.bindFramebuffer(i.FRAMEBUFFER,w),$t(x)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,$,J,Q.__webglTexture,0,Gt(x)):(J===i.TEXTURE_2D||J>=i.TEXTURE_CUBE_MAP_POSITIVE_X&&J<=i.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&i.framebufferTexture2D(i.FRAMEBUFFER,$,J,Q.__webglTexture,K),e.bindFramebuffer(i.FRAMEBUFFER,null)}function st(w,x,B){if(i.bindRenderbuffer(i.RENDERBUFFER,w),x.depthBuffer){const $=x.depthTexture,J=$&&$.isDepthTexture?$.type:null,K=S(x.stencilBuffer,J),xt=x.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,rt=Gt(x);$t(x)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,rt,K,x.width,x.height):B?i.renderbufferStorageMultisample(i.RENDERBUFFER,rt,K,x.width,x.height):i.renderbufferStorage(i.RENDERBUFFER,K,x.width,x.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,xt,i.RENDERBUFFER,w)}else{const $=x.textures;for(let J=0;J<$.length;J++){const K=$[J],xt=r.convert(K.format,K.colorSpace),rt=r.convert(K.type),pt=y(K.internalFormat,xt,rt,K.colorSpace),Zt=Gt(x);B&&$t(x)===!1?i.renderbufferStorageMultisample(i.RENDERBUFFER,Zt,pt,x.width,x.height):$t(x)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,Zt,pt,x.width,x.height):i.renderbufferStorage(i.RENDERBUFFER,pt,x.width,x.height)}}i.bindRenderbuffer(i.RENDERBUFFER,null)}function Lt(w,x){if(x&&x.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(e.bindFramebuffer(i.FRAMEBUFFER,w),!(x.depthTexture&&x.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");const $=n.get(x.depthTexture);$.__renderTarget=x,(!$.__webglTexture||x.depthTexture.image.width!==x.width||x.depthTexture.image.height!==x.height)&&(x.depthTexture.image.width=x.width,x.depthTexture.image.height=x.height,x.depthTexture.needsUpdate=!0),W(x.depthTexture,0);const J=$.__webglTexture,K=Gt(x);if(x.depthTexture.format===Ks)$t(x)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.TEXTURE_2D,J,0,K):i.framebufferTexture2D(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.TEXTURE_2D,J,0);else if(x.depthTexture.format===nr)$t(x)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.TEXTURE_2D,J,0,K):i.framebufferTexture2D(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.TEXTURE_2D,J,0);else throw new Error("Unknown depthTexture format")}function It(w){const x=n.get(w),B=w.isWebGLCubeRenderTarget===!0;if(x.__boundDepthTexture!==w.depthTexture){const $=w.depthTexture;if(x.__depthDisposeCallback&&x.__depthDisposeCallback(),$){const J=()=>{delete x.__boundDepthTexture,delete x.__depthDisposeCallback,$.removeEventListener("dispose",J)};$.addEventListener("dispose",J),x.__depthDisposeCallback=J}x.__boundDepthTexture=$}if(w.depthTexture&&!x.__autoAllocateDepthBuffer){if(B)throw new Error("target.depthTexture not supported in Cube render targets");Lt(x.__webglFramebuffer,w)}else if(B){x.__webglDepthbuffer=[];for(let $=0;$<6;$++)if(e.bindFramebuffer(i.FRAMEBUFFER,x.__webglFramebuffer[$]),x.__webglDepthbuffer[$]===void 0)x.__webglDepthbuffer[$]=i.createRenderbuffer(),st(x.__webglDepthbuffer[$],w,!1);else{const J=w.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,K=x.__webglDepthbuffer[$];i.bindRenderbuffer(i.RENDERBUFFER,K),i.framebufferRenderbuffer(i.FRAMEBUFFER,J,i.RENDERBUFFER,K)}}else if(e.bindFramebuffer(i.FRAMEBUFFER,x.__webglFramebuffer),x.__webglDepthbuffer===void 0)x.__webglDepthbuffer=i.createRenderbuffer(),st(x.__webglDepthbuffer,w,!1);else{const $=w.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,J=x.__webglDepthbuffer;i.bindRenderbuffer(i.RENDERBUFFER,J),i.framebufferRenderbuffer(i.FRAMEBUFFER,$,i.RENDERBUFFER,J)}e.bindFramebuffer(i.FRAMEBUFFER,null)}function zt(w,x,B){const $=n.get(w);x!==void 0&&_t($.__webglFramebuffer,w,w.texture,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,0),B!==void 0&&It(w)}function _e(w){const x=w.texture,B=n.get(w),$=n.get(x);w.addEventListener("dispose",R);const J=w.textures,K=w.isWebGLCubeRenderTarget===!0,xt=J.length>1;if(xt||($.__webglTexture===void 0&&($.__webglTexture=i.createTexture()),$.__version=x.version,a.memory.textures++),K){B.__webglFramebuffer=[];for(let rt=0;rt<6;rt++)if(x.mipmaps&&x.mipmaps.length>0){B.__webglFramebuffer[rt]=[];for(let pt=0;pt<x.mipmaps.length;pt++)B.__webglFramebuffer[rt][pt]=i.createFramebuffer()}else B.__webglFramebuffer[rt]=i.createFramebuffer()}else{if(x.mipmaps&&x.mipmaps.length>0){B.__webglFramebuffer=[];for(let rt=0;rt<x.mipmaps.length;rt++)B.__webglFramebuffer[rt]=i.createFramebuffer()}else B.__webglFramebuffer=i.createFramebuffer();if(xt)for(let rt=0,pt=J.length;rt<pt;rt++){const Zt=n.get(J[rt]);Zt.__webglTexture===void 0&&(Zt.__webglTexture=i.createTexture(),a.memory.textures++)}if(w.samples>0&&$t(w)===!1){B.__webglMultisampledFramebuffer=i.createFramebuffer(),B.__webglColorRenderbuffer=[],e.bindFramebuffer(i.FRAMEBUFFER,B.__webglMultisampledFramebuffer);for(let rt=0;rt<J.length;rt++){const pt=J[rt];B.__webglColorRenderbuffer[rt]=i.createRenderbuffer(),i.bindRenderbuffer(i.RENDERBUFFER,B.__webglColorRenderbuffer[rt]);const Zt=r.convert(pt.format,pt.colorSpace),Q=r.convert(pt.type),mt=y(pt.internalFormat,Zt,Q,pt.colorSpace,w.isXRRenderTarget===!0),Dt=Gt(w);i.renderbufferStorageMultisample(i.RENDERBUFFER,Dt,mt,w.width,w.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+rt,i.RENDERBUFFER,B.__webglColorRenderbuffer[rt])}i.bindRenderbuffer(i.RENDERBUFFER,null),w.depthBuffer&&(B.__webglDepthRenderbuffer=i.createRenderbuffer(),st(B.__webglDepthRenderbuffer,w,!0)),e.bindFramebuffer(i.FRAMEBUFFER,null)}}if(K){e.bindTexture(i.TEXTURE_CUBE_MAP,$.__webglTexture),Ct(i.TEXTURE_CUBE_MAP,x);for(let rt=0;rt<6;rt++)if(x.mipmaps&&x.mipmaps.length>0)for(let pt=0;pt<x.mipmaps.length;pt++)_t(B.__webglFramebuffer[rt][pt],w,x,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+rt,pt);else _t(B.__webglFramebuffer[rt],w,x,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+rt,0);m(x)&&d(i.TEXTURE_CUBE_MAP),e.unbindTexture()}else if(xt){for(let rt=0,pt=J.length;rt<pt;rt++){const Zt=J[rt],Q=n.get(Zt);e.bindTexture(i.TEXTURE_2D,Q.__webglTexture),Ct(i.TEXTURE_2D,Zt),_t(B.__webglFramebuffer,w,Zt,i.COLOR_ATTACHMENT0+rt,i.TEXTURE_2D,0),m(Zt)&&d(i.TEXTURE_2D)}e.unbindTexture()}else{let rt=i.TEXTURE_2D;if((w.isWebGL3DRenderTarget||w.isWebGLArrayRenderTarget)&&(rt=w.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),e.bindTexture(rt,$.__webglTexture),Ct(rt,x),x.mipmaps&&x.mipmaps.length>0)for(let pt=0;pt<x.mipmaps.length;pt++)_t(B.__webglFramebuffer[pt],w,x,i.COLOR_ATTACHMENT0,rt,pt);else _t(B.__webglFramebuffer,w,x,i.COLOR_ATTACHMENT0,rt,0);m(x)&&d(rt),e.unbindTexture()}w.depthBuffer&&It(w)}function qt(w){const x=w.textures;for(let B=0,$=x.length;B<$;B++){const J=x[B];if(m(J)){const K=E(w),xt=n.get(J).__webglTexture;e.bindTexture(K,xt),d(K),e.unbindTexture()}}}const Se=[],U=[];function Ze(w){if(w.samples>0){if($t(w)===!1){const x=w.textures,B=w.width,$=w.height;let J=i.COLOR_BUFFER_BIT;const K=w.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,xt=n.get(w),rt=x.length>1;if(rt)for(let pt=0;pt<x.length;pt++)e.bindFramebuffer(i.FRAMEBUFFER,xt.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+pt,i.RENDERBUFFER,null),e.bindFramebuffer(i.FRAMEBUFFER,xt.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+pt,i.TEXTURE_2D,null,0);e.bindFramebuffer(i.READ_FRAMEBUFFER,xt.__webglMultisampledFramebuffer),e.bindFramebuffer(i.DRAW_FRAMEBUFFER,xt.__webglFramebuffer);for(let pt=0;pt<x.length;pt++){if(w.resolveDepthBuffer&&(w.depthBuffer&&(J|=i.DEPTH_BUFFER_BIT),w.stencilBuffer&&w.resolveStencilBuffer&&(J|=i.STENCIL_BUFFER_BIT)),rt){i.framebufferRenderbuffer(i.READ_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.RENDERBUFFER,xt.__webglColorRenderbuffer[pt]);const Zt=n.get(x[pt]).__webglTexture;i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,Zt,0)}i.blitFramebuffer(0,0,B,$,0,0,B,$,J,i.NEAREST),l===!0&&(Se.length=0,U.length=0,Se.push(i.COLOR_ATTACHMENT0+pt),w.depthBuffer&&w.resolveDepthBuffer===!1&&(Se.push(K),U.push(K),i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,U)),i.invalidateFramebuffer(i.READ_FRAMEBUFFER,Se))}if(e.bindFramebuffer(i.READ_FRAMEBUFFER,null),e.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),rt)for(let pt=0;pt<x.length;pt++){e.bindFramebuffer(i.FRAMEBUFFER,xt.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+pt,i.RENDERBUFFER,xt.__webglColorRenderbuffer[pt]);const Zt=n.get(x[pt]).__webglTexture;e.bindFramebuffer(i.FRAMEBUFFER,xt.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+pt,i.TEXTURE_2D,Zt,0)}e.bindFramebuffer(i.DRAW_FRAMEBUFFER,xt.__webglMultisampledFramebuffer)}else if(w.depthBuffer&&w.resolveDepthBuffer===!1&&l){const x=w.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,[x])}}}function Gt(w){return Math.min(s.maxSamples,w.samples)}function $t(w){const x=n.get(w);return w.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&x.__useRenderToTexture!==!1}function Et(w){const x=a.render.frame;f.get(w)!==x&&(f.set(w,x),w.update())}function oe(w,x){const B=w.colorSpace,$=w.format,J=w.type;return w.isCompressedTexture===!0||w.isVideoTexture===!0||B!==ls&&B!==Ci&&(ae.getTransfer(B)===ge?($!==Hn||J!==jn)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",B)),x}function At(w){return typeof HTMLImageElement<"u"&&w instanceof HTMLImageElement?(c.width=w.naturalWidth||w.width,c.height=w.naturalHeight||w.height):typeof VideoFrame<"u"&&w instanceof VideoFrame?(c.width=w.displayWidth,c.height=w.displayHeight):(c.width=w.width,c.height=w.height),c}this.allocateTextureUnit=z,this.resetTextureUnits=V,this.setTexture2D=W,this.setTexture2DArray=G,this.setTexture3D=Z,this.setTextureCube=H,this.rebindTextures=zt,this.setupRenderTarget=_e,this.updateRenderTargetMipmap=qt,this.updateMultisampleRenderTarget=Ze,this.setupDepthRenderbuffer=It,this.setupFrameBufferTexture=_t,this.useMultisampledRTT=$t}function Ng(i,t){function e(n,s=Ci){let r;const a=ae.getTransfer(s);if(n===jn)return i.UNSIGNED_BYTE;if(n===Ol)return i.UNSIGNED_SHORT_4_4_4_4;if(n===Bl)return i.UNSIGNED_SHORT_5_5_5_1;if(n===Bh)return i.UNSIGNED_INT_5_9_9_9_REV;if(n===Fh)return i.BYTE;if(n===Oh)return i.SHORT;if(n===Br)return i.UNSIGNED_SHORT;if(n===Fl)return i.INT;if(n===ss)return i.UNSIGNED_INT;if(n===qn)return i.FLOAT;if(n===ar)return i.HALF_FLOAT;if(n===zh)return i.ALPHA;if(n===kh)return i.RGB;if(n===Hn)return i.RGBA;if(n===Hh)return i.LUMINANCE;if(n===Gh)return i.LUMINANCE_ALPHA;if(n===Ks)return i.DEPTH_COMPONENT;if(n===nr)return i.DEPTH_STENCIL;if(n===zl)return i.RED;if(n===kl)return i.RED_INTEGER;if(n===Vh)return i.RG;if(n===Hl)return i.RG_INTEGER;if(n===Gl)return i.RGBA_INTEGER;if(n===Ra||n===Ca||n===Pa||n===La)if(a===ge)if(r=t.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(n===Ra)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===Ca)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===Pa)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===La)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=t.get("WEBGL_compressed_texture_s3tc"),r!==null){if(n===Ra)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===Ca)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===Pa)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===La)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===$o||n===jo||n===Jo||n===Qo)if(r=t.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(n===$o)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===jo)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===Jo)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===Qo)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===tl||n===el||n===nl)if(r=t.get("WEBGL_compressed_texture_etc"),r!==null){if(n===tl||n===el)return a===ge?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(n===nl)return a===ge?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(n===il||n===sl||n===rl||n===al||n===ol||n===ll||n===cl||n===hl||n===fl||n===ul||n===dl||n===pl||n===ml||n===gl)if(r=t.get("WEBGL_compressed_texture_astc"),r!==null){if(n===il)return a===ge?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===sl)return a===ge?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===rl)return a===ge?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===al)return a===ge?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===ol)return a===ge?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===ll)return a===ge?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===cl)return a===ge?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===hl)return a===ge?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===fl)return a===ge?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===ul)return a===ge?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===dl)return a===ge?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===pl)return a===ge?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===ml)return a===ge?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===gl)return a===ge?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===Da||n===_l||n===xl)if(r=t.get("EXT_texture_compression_bptc"),r!==null){if(n===Da)return a===ge?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===_l)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===xl)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===Wh||n===vl||n===Ml||n===Sl)if(r=t.get("EXT_texture_compression_rgtc"),r!==null){if(n===Da)return r.COMPRESSED_RED_RGTC1_EXT;if(n===vl)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===Ml)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===Sl)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===er?i.UNSIGNED_INT_24_8:i[n]!==void 0?i[n]:null}return{convert:e}}class Fg extends zn{constructor(t=[]){super(),this.isArrayCamera=!0,this.cameras=t}}class kt extends Oe{constructor(){super(),this.isGroup=!0,this.type="Group"}}const Og={type:"move"};class wo{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new kt,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new kt,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new F,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new F),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new kt,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new F,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new F),this._grip}dispatchEvent(t){return this._targetRay!==null&&this._targetRay.dispatchEvent(t),this._grip!==null&&this._grip.dispatchEvent(t),this._hand!==null&&this._hand.dispatchEvent(t),this}connect(t){if(t&&t.hand){const e=this._hand;if(e)for(const n of t.hand.values())this._getHandJoint(e,n)}return this.dispatchEvent({type:"connected",data:t}),this}disconnect(t){return this.dispatchEvent({type:"disconnected",data:t}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(t,e,n){let s=null,r=null,a=null;const o=this._targetRay,l=this._grip,c=this._hand;if(t&&e.session.visibilityState!=="visible-blurred"){if(c&&t.hand){a=!0;for(const _ of t.hand.values()){const m=e.getJointPose(_,n),d=this._getHandJoint(c,_);m!==null&&(d.matrix.fromArray(m.transform.matrix),d.matrix.decompose(d.position,d.rotation,d.scale),d.matrixWorldNeedsUpdate=!0,d.jointRadius=m.radius),d.visible=m!==null}const f=c.joints["index-finger-tip"],h=c.joints["thumb-tip"],u=f.position.distanceTo(h.position),p=.02,g=.005;c.inputState.pinching&&u>p+g?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:t.handedness,target:this})):!c.inputState.pinching&&u<=p-g&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:t.handedness,target:this}))}else l!==null&&t.gripSpace&&(r=e.getPose(t.gripSpace,n),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1));o!==null&&(s=e.getPose(t.targetRaySpace,n),s===null&&r!==null&&(s=r),s!==null&&(o.matrix.fromArray(s.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,s.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(s.linearVelocity)):o.hasLinearVelocity=!1,s.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(s.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(Og)))}return o!==null&&(o.visible=s!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(t,e){if(t.joints[e.jointName]===void 0){const n=new kt;n.matrixAutoUpdate=!1,n.visible=!1,t.joints[e.jointName]=n,t.add(n)}return t.joints[e.jointName]}}const Bg=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,zg=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class kg{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(t,e,n){if(this.texture===null){const s=new tn,r=t.properties.get(s);r.__webglTexture=e.texture,(e.depthNear!=n.depthNear||e.depthFar!=n.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=s}}getMesh(t){if(this.texture!==null&&this.mesh===null){const e=t.cameras[0].viewport,n=new gi({vertexShader:Bg,fragmentShader:zg,uniforms:{depthColor:{value:this.texture},depthWidth:{value:e.z},depthHeight:{value:e.w}}});this.mesh=new Rt(new Te(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class Hg extends or{constructor(t,e){super();const n=this;let s=null,r=1,a=null,o="local-floor",l=1,c=null,f=null,h=null,u=null,p=null,g=null;const _=new kg,m=e.getContextAttributes();let d=null,E=null;const y=[],S=[],O=new Yt;let T=null;const R=new zn;R.viewport=new Re;const I=new zn;I.viewport=new Re;const b=[R,I],M=new Fg;let A=null,V=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(Y){let tt=y[Y];return tt===void 0&&(tt=new wo,y[Y]=tt),tt.getTargetRaySpace()},this.getControllerGrip=function(Y){let tt=y[Y];return tt===void 0&&(tt=new wo,y[Y]=tt),tt.getGripSpace()},this.getHand=function(Y){let tt=y[Y];return tt===void 0&&(tt=new wo,y[Y]=tt),tt.getHandSpace()};function z(Y){const tt=S.indexOf(Y.inputSource);if(tt===-1)return;const _t=y[tt];_t!==void 0&&(_t.update(Y.inputSource,Y.frame,c||a),_t.dispatchEvent({type:Y.type,data:Y.inputSource}))}function C(){s.removeEventListener("select",z),s.removeEventListener("selectstart",z),s.removeEventListener("selectend",z),s.removeEventListener("squeeze",z),s.removeEventListener("squeezestart",z),s.removeEventListener("squeezeend",z),s.removeEventListener("end",C),s.removeEventListener("inputsourceschange",W);for(let Y=0;Y<y.length;Y++){const tt=S[Y];tt!==null&&(S[Y]=null,y[Y].disconnect(tt))}A=null,V=null,_.reset(),t.setRenderTarget(d),p=null,u=null,h=null,s=null,E=null,Jt.stop(),n.isPresenting=!1,t.setPixelRatio(T),t.setSize(O.width,O.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(Y){r=Y,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(Y){o=Y,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(Y){c=Y},this.getBaseLayer=function(){return u!==null?u:p},this.getBinding=function(){return h},this.getFrame=function(){return g},this.getSession=function(){return s},this.setSession=async function(Y){if(s=Y,s!==null){if(d=t.getRenderTarget(),s.addEventListener("select",z),s.addEventListener("selectstart",z),s.addEventListener("selectend",z),s.addEventListener("squeeze",z),s.addEventListener("squeezestart",z),s.addEventListener("squeezeend",z),s.addEventListener("end",C),s.addEventListener("inputsourceschange",W),m.xrCompatible!==!0&&await e.makeXRCompatible(),T=t.getPixelRatio(),t.getSize(O),s.renderState.layers===void 0){const tt={antialias:m.antialias,alpha:!0,depth:m.depth,stencil:m.stencil,framebufferScaleFactor:r};p=new XRWebGLLayer(s,e,tt),s.updateRenderState({baseLayer:p}),t.setPixelRatio(1),t.setSize(p.framebufferWidth,p.framebufferHeight,!1),E=new Ui(p.framebufferWidth,p.framebufferHeight,{format:Hn,type:jn,colorSpace:t.outputColorSpace,stencilBuffer:m.stencil})}else{let tt=null,_t=null,st=null;m.depth&&(st=m.stencil?e.DEPTH24_STENCIL8:e.DEPTH_COMPONENT24,tt=m.stencil?nr:Ks,_t=m.stencil?er:ss);const Lt={colorFormat:e.RGBA8,depthFormat:st,scaleFactor:r};h=new XRWebGLBinding(s,e),u=h.createProjectionLayer(Lt),s.updateRenderState({layers:[u]}),t.setPixelRatio(1),t.setSize(u.textureWidth,u.textureHeight,!1),E=new Ui(u.textureWidth,u.textureHeight,{format:Hn,type:jn,depthTexture:new Zl(u.textureWidth,u.textureHeight,_t,void 0,void 0,void 0,void 0,void 0,void 0,tt),stencilBuffer:m.stencil,colorSpace:t.outputColorSpace,samples:m.antialias?4:0,resolveDepthBuffer:u.ignoreDepthValues===!1})}E.isXRRenderTarget=!0,this.setFoveation(l),c=null,a=await s.requestReferenceSpace(o),Jt.setContext(s),Jt.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return _.getDepthTexture()};function W(Y){for(let tt=0;tt<Y.removed.length;tt++){const _t=Y.removed[tt],st=S.indexOf(_t);st>=0&&(S[st]=null,y[st].disconnect(_t))}for(let tt=0;tt<Y.added.length;tt++){const _t=Y.added[tt];let st=S.indexOf(_t);if(st===-1){for(let It=0;It<y.length;It++)if(It>=S.length){S.push(_t),st=It;break}else if(S[It]===null){S[It]=_t,st=It;break}if(st===-1)break}const Lt=y[st];Lt&&Lt.connect(_t)}}const G=new F,Z=new F;function H(Y,tt,_t){G.setFromMatrixPosition(tt.matrixWorld),Z.setFromMatrixPosition(_t.matrixWorld);const st=G.distanceTo(Z),Lt=tt.projectionMatrix.elements,It=_t.projectionMatrix.elements,zt=Lt[14]/(Lt[10]-1),_e=Lt[14]/(Lt[10]+1),qt=(Lt[9]+1)/Lt[5],Se=(Lt[9]-1)/Lt[5],U=(Lt[8]-1)/Lt[0],Ze=(It[8]+1)/It[0],Gt=zt*U,$t=zt*Ze,Et=st/(-U+Ze),oe=Et*-U;if(tt.matrixWorld.decompose(Y.position,Y.quaternion,Y.scale),Y.translateX(oe),Y.translateZ(Et),Y.matrixWorld.compose(Y.position,Y.quaternion,Y.scale),Y.matrixWorldInverse.copy(Y.matrixWorld).invert(),Lt[10]===-1)Y.projectionMatrix.copy(tt.projectionMatrix),Y.projectionMatrixInverse.copy(tt.projectionMatrixInverse);else{const At=zt+Et,w=_e+Et,x=Gt-oe,B=$t+(st-oe),$=qt*_e/w*At,J=Se*_e/w*At;Y.projectionMatrix.makePerspective(x,B,$,J,At,w),Y.projectionMatrixInverse.copy(Y.projectionMatrix).invert()}}function it(Y,tt){tt===null?Y.matrixWorld.copy(Y.matrix):Y.matrixWorld.multiplyMatrices(tt.matrixWorld,Y.matrix),Y.matrixWorldInverse.copy(Y.matrixWorld).invert()}this.updateCamera=function(Y){if(s===null)return;let tt=Y.near,_t=Y.far;_.texture!==null&&(_.depthNear>0&&(tt=_.depthNear),_.depthFar>0&&(_t=_.depthFar)),M.near=I.near=R.near=tt,M.far=I.far=R.far=_t,(A!==M.near||V!==M.far)&&(s.updateRenderState({depthNear:M.near,depthFar:M.far}),A=M.near,V=M.far),R.layers.mask=Y.layers.mask|2,I.layers.mask=Y.layers.mask|4,M.layers.mask=R.layers.mask|I.layers.mask;const st=Y.parent,Lt=M.cameras;it(M,st);for(let It=0;It<Lt.length;It++)it(Lt[It],st);Lt.length===2?H(M,R,I):M.projectionMatrix.copy(R.projectionMatrix),ot(Y,M,st)};function ot(Y,tt,_t){_t===null?Y.matrix.copy(tt.matrixWorld):(Y.matrix.copy(_t.matrixWorld),Y.matrix.invert(),Y.matrix.multiply(tt.matrixWorld)),Y.matrix.decompose(Y.position,Y.quaternion,Y.scale),Y.updateMatrixWorld(!0),Y.projectionMatrix.copy(tt.projectionMatrix),Y.projectionMatrixInverse.copy(tt.projectionMatrixInverse),Y.isPerspectiveCamera&&(Y.fov=zr*2*Math.atan(1/Y.projectionMatrix.elements[5]),Y.zoom=1)}this.getCamera=function(){return M},this.getFoveation=function(){if(!(u===null&&p===null))return l},this.setFoveation=function(Y){l=Y,u!==null&&(u.fixedFoveation=Y),p!==null&&p.fixedFoveation!==void 0&&(p.fixedFoveation=Y)},this.hasDepthSensing=function(){return _.texture!==null},this.getDepthSensingMesh=function(){return _.getMesh(M)};let gt=null;function Ct(Y,tt){if(f=tt.getViewerPose(c||a),g=tt,f!==null){const _t=f.views;p!==null&&(t.setRenderTargetFramebuffer(E,p.framebuffer),t.setRenderTarget(E));let st=!1;_t.length!==M.cameras.length&&(M.cameras.length=0,st=!0);for(let It=0;It<_t.length;It++){const zt=_t[It];let _e=null;if(p!==null)_e=p.getViewport(zt);else{const Se=h.getViewSubImage(u,zt);_e=Se.viewport,It===0&&(t.setRenderTargetTextures(E,Se.colorTexture,u.ignoreDepthValues?void 0:Se.depthStencilTexture),t.setRenderTarget(E))}let qt=b[It];qt===void 0&&(qt=new zn,qt.layers.enable(It),qt.viewport=new Re,b[It]=qt),qt.matrix.fromArray(zt.transform.matrix),qt.matrix.decompose(qt.position,qt.quaternion,qt.scale),qt.projectionMatrix.fromArray(zt.projectionMatrix),qt.projectionMatrixInverse.copy(qt.projectionMatrix).invert(),qt.viewport.set(_e.x,_e.y,_e.width,_e.height),It===0&&(M.matrix.copy(qt.matrix),M.matrix.decompose(M.position,M.quaternion,M.scale)),st===!0&&M.cameras.push(qt)}const Lt=s.enabledFeatures;if(Lt&&Lt.includes("depth-sensing")){const It=h.getDepthInformation(_t[0]);It&&It.isValid&&It.texture&&_.init(t,It,s.renderState)}}for(let _t=0;_t<y.length;_t++){const st=S[_t],Lt=y[_t];st!==null&&Lt!==void 0&&Lt.update(st,tt,c||a)}gt&&gt(Y,tt),tt.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:tt}),g=null}const Jt=new nf;Jt.setAnimationLoop(Ct),this.setAnimationLoop=function(Y){gt=Y},this.dispose=function(){}}}const Wi=new In,Gg=new ue;function Vg(i,t){function e(m,d){m.matrixAutoUpdate===!0&&m.updateMatrix(),d.value.copy(m.matrix)}function n(m,d){d.color.getRGB(m.fogColor.value,Qh(i)),d.isFog?(m.fogNear.value=d.near,m.fogFar.value=d.far):d.isFogExp2&&(m.fogDensity.value=d.density)}function s(m,d,E,y,S){d.isMeshBasicMaterial||d.isMeshLambertMaterial?r(m,d):d.isMeshToonMaterial?(r(m,d),h(m,d)):d.isMeshPhongMaterial?(r(m,d),f(m,d)):d.isMeshStandardMaterial?(r(m,d),u(m,d),d.isMeshPhysicalMaterial&&p(m,d,S)):d.isMeshMatcapMaterial?(r(m,d),g(m,d)):d.isMeshDepthMaterial?r(m,d):d.isMeshDistanceMaterial?(r(m,d),_(m,d)):d.isMeshNormalMaterial?r(m,d):d.isLineBasicMaterial?(a(m,d),d.isLineDashedMaterial&&o(m,d)):d.isPointsMaterial?l(m,d,E,y):d.isSpriteMaterial?c(m,d):d.isShadowMaterial?(m.color.value.copy(d.color),m.opacity.value=d.opacity):d.isShaderMaterial&&(d.uniformsNeedUpdate=!1)}function r(m,d){m.opacity.value=d.opacity,d.color&&m.diffuse.value.copy(d.color),d.emissive&&m.emissive.value.copy(d.emissive).multiplyScalar(d.emissiveIntensity),d.map&&(m.map.value=d.map,e(d.map,m.mapTransform)),d.alphaMap&&(m.alphaMap.value=d.alphaMap,e(d.alphaMap,m.alphaMapTransform)),d.bumpMap&&(m.bumpMap.value=d.bumpMap,e(d.bumpMap,m.bumpMapTransform),m.bumpScale.value=d.bumpScale,d.side===vn&&(m.bumpScale.value*=-1)),d.normalMap&&(m.normalMap.value=d.normalMap,e(d.normalMap,m.normalMapTransform),m.normalScale.value.copy(d.normalScale),d.side===vn&&m.normalScale.value.negate()),d.displacementMap&&(m.displacementMap.value=d.displacementMap,e(d.displacementMap,m.displacementMapTransform),m.displacementScale.value=d.displacementScale,m.displacementBias.value=d.displacementBias),d.emissiveMap&&(m.emissiveMap.value=d.emissiveMap,e(d.emissiveMap,m.emissiveMapTransform)),d.specularMap&&(m.specularMap.value=d.specularMap,e(d.specularMap,m.specularMapTransform)),d.alphaTest>0&&(m.alphaTest.value=d.alphaTest);const E=t.get(d),y=E.envMap,S=E.envMapRotation;y&&(m.envMap.value=y,Wi.copy(S),Wi.x*=-1,Wi.y*=-1,Wi.z*=-1,y.isCubeTexture&&y.isRenderTargetTexture===!1&&(Wi.y*=-1,Wi.z*=-1),m.envMapRotation.value.setFromMatrix4(Gg.makeRotationFromEuler(Wi)),m.flipEnvMap.value=y.isCubeTexture&&y.isRenderTargetTexture===!1?-1:1,m.reflectivity.value=d.reflectivity,m.ior.value=d.ior,m.refractionRatio.value=d.refractionRatio),d.lightMap&&(m.lightMap.value=d.lightMap,m.lightMapIntensity.value=d.lightMapIntensity,e(d.lightMap,m.lightMapTransform)),d.aoMap&&(m.aoMap.value=d.aoMap,m.aoMapIntensity.value=d.aoMapIntensity,e(d.aoMap,m.aoMapTransform))}function a(m,d){m.diffuse.value.copy(d.color),m.opacity.value=d.opacity,d.map&&(m.map.value=d.map,e(d.map,m.mapTransform))}function o(m,d){m.dashSize.value=d.dashSize,m.totalSize.value=d.dashSize+d.gapSize,m.scale.value=d.scale}function l(m,d,E,y){m.diffuse.value.copy(d.color),m.opacity.value=d.opacity,m.size.value=d.size*E,m.scale.value=y*.5,d.map&&(m.map.value=d.map,e(d.map,m.uvTransform)),d.alphaMap&&(m.alphaMap.value=d.alphaMap,e(d.alphaMap,m.alphaMapTransform)),d.alphaTest>0&&(m.alphaTest.value=d.alphaTest)}function c(m,d){m.diffuse.value.copy(d.color),m.opacity.value=d.opacity,m.rotation.value=d.rotation,d.map&&(m.map.value=d.map,e(d.map,m.mapTransform)),d.alphaMap&&(m.alphaMap.value=d.alphaMap,e(d.alphaMap,m.alphaMapTransform)),d.alphaTest>0&&(m.alphaTest.value=d.alphaTest)}function f(m,d){m.specular.value.copy(d.specular),m.shininess.value=Math.max(d.shininess,1e-4)}function h(m,d){d.gradientMap&&(m.gradientMap.value=d.gradientMap)}function u(m,d){m.metalness.value=d.metalness,d.metalnessMap&&(m.metalnessMap.value=d.metalnessMap,e(d.metalnessMap,m.metalnessMapTransform)),m.roughness.value=d.roughness,d.roughnessMap&&(m.roughnessMap.value=d.roughnessMap,e(d.roughnessMap,m.roughnessMapTransform)),d.envMap&&(m.envMapIntensity.value=d.envMapIntensity)}function p(m,d,E){m.ior.value=d.ior,d.sheen>0&&(m.sheenColor.value.copy(d.sheenColor).multiplyScalar(d.sheen),m.sheenRoughness.value=d.sheenRoughness,d.sheenColorMap&&(m.sheenColorMap.value=d.sheenColorMap,e(d.sheenColorMap,m.sheenColorMapTransform)),d.sheenRoughnessMap&&(m.sheenRoughnessMap.value=d.sheenRoughnessMap,e(d.sheenRoughnessMap,m.sheenRoughnessMapTransform))),d.clearcoat>0&&(m.clearcoat.value=d.clearcoat,m.clearcoatRoughness.value=d.clearcoatRoughness,d.clearcoatMap&&(m.clearcoatMap.value=d.clearcoatMap,e(d.clearcoatMap,m.clearcoatMapTransform)),d.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=d.clearcoatRoughnessMap,e(d.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),d.clearcoatNormalMap&&(m.clearcoatNormalMap.value=d.clearcoatNormalMap,e(d.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(d.clearcoatNormalScale),d.side===vn&&m.clearcoatNormalScale.value.negate())),d.dispersion>0&&(m.dispersion.value=d.dispersion),d.iridescence>0&&(m.iridescence.value=d.iridescence,m.iridescenceIOR.value=d.iridescenceIOR,m.iridescenceThicknessMinimum.value=d.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=d.iridescenceThicknessRange[1],d.iridescenceMap&&(m.iridescenceMap.value=d.iridescenceMap,e(d.iridescenceMap,m.iridescenceMapTransform)),d.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=d.iridescenceThicknessMap,e(d.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),d.transmission>0&&(m.transmission.value=d.transmission,m.transmissionSamplerMap.value=E.texture,m.transmissionSamplerSize.value.set(E.width,E.height),d.transmissionMap&&(m.transmissionMap.value=d.transmissionMap,e(d.transmissionMap,m.transmissionMapTransform)),m.thickness.value=d.thickness,d.thicknessMap&&(m.thicknessMap.value=d.thicknessMap,e(d.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=d.attenuationDistance,m.attenuationColor.value.copy(d.attenuationColor)),d.anisotropy>0&&(m.anisotropyVector.value.set(d.anisotropy*Math.cos(d.anisotropyRotation),d.anisotropy*Math.sin(d.anisotropyRotation)),d.anisotropyMap&&(m.anisotropyMap.value=d.anisotropyMap,e(d.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=d.specularIntensity,m.specularColor.value.copy(d.specularColor),d.specularColorMap&&(m.specularColorMap.value=d.specularColorMap,e(d.specularColorMap,m.specularColorMapTransform)),d.specularIntensityMap&&(m.specularIntensityMap.value=d.specularIntensityMap,e(d.specularIntensityMap,m.specularIntensityMapTransform))}function g(m,d){d.matcap&&(m.matcap.value=d.matcap)}function _(m,d){const E=t.get(d).light;m.referencePosition.value.setFromMatrixPosition(E.matrixWorld),m.nearDistance.value=E.shadow.camera.near,m.farDistance.value=E.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:s}}function Wg(i,t,e,n){let s={},r={},a=[];const o=i.getParameter(i.MAX_UNIFORM_BUFFER_BINDINGS);function l(E,y){const S=y.program;n.uniformBlockBinding(E,S)}function c(E,y){let S=s[E.id];S===void 0&&(g(E),S=f(E),s[E.id]=S,E.addEventListener("dispose",m));const O=y.program;n.updateUBOMapping(E,O);const T=t.render.frame;r[E.id]!==T&&(u(E),r[E.id]=T)}function f(E){const y=h();E.__bindingPointIndex=y;const S=i.createBuffer(),O=E.__size,T=E.usage;return i.bindBuffer(i.UNIFORM_BUFFER,S),i.bufferData(i.UNIFORM_BUFFER,O,T),i.bindBuffer(i.UNIFORM_BUFFER,null),i.bindBufferBase(i.UNIFORM_BUFFER,y,S),S}function h(){for(let E=0;E<o;E++)if(a.indexOf(E)===-1)return a.push(E),E;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function u(E){const y=s[E.id],S=E.uniforms,O=E.__cache;i.bindBuffer(i.UNIFORM_BUFFER,y);for(let T=0,R=S.length;T<R;T++){const I=Array.isArray(S[T])?S[T]:[S[T]];for(let b=0,M=I.length;b<M;b++){const A=I[b];if(p(A,T,b,O)===!0){const V=A.__offset,z=Array.isArray(A.value)?A.value:[A.value];let C=0;for(let W=0;W<z.length;W++){const G=z[W],Z=_(G);typeof G=="number"||typeof G=="boolean"?(A.__data[0]=G,i.bufferSubData(i.UNIFORM_BUFFER,V+C,A.__data)):G.isMatrix3?(A.__data[0]=G.elements[0],A.__data[1]=G.elements[1],A.__data[2]=G.elements[2],A.__data[3]=0,A.__data[4]=G.elements[3],A.__data[5]=G.elements[4],A.__data[6]=G.elements[5],A.__data[7]=0,A.__data[8]=G.elements[6],A.__data[9]=G.elements[7],A.__data[10]=G.elements[8],A.__data[11]=0):(G.toArray(A.__data,C),C+=Z.storage/Float32Array.BYTES_PER_ELEMENT)}i.bufferSubData(i.UNIFORM_BUFFER,V,A.__data)}}}i.bindBuffer(i.UNIFORM_BUFFER,null)}function p(E,y,S,O){const T=E.value,R=y+"_"+S;if(O[R]===void 0)return typeof T=="number"||typeof T=="boolean"?O[R]=T:O[R]=T.clone(),!0;{const I=O[R];if(typeof T=="number"||typeof T=="boolean"){if(I!==T)return O[R]=T,!0}else if(I.equals(T)===!1)return I.copy(T),!0}return!1}function g(E){const y=E.uniforms;let S=0;const O=16;for(let R=0,I=y.length;R<I;R++){const b=Array.isArray(y[R])?y[R]:[y[R]];for(let M=0,A=b.length;M<A;M++){const V=b[M],z=Array.isArray(V.value)?V.value:[V.value];for(let C=0,W=z.length;C<W;C++){const G=z[C],Z=_(G),H=S%O,it=H%Z.boundary,ot=H+it;S+=it,ot!==0&&O-ot<Z.storage&&(S+=O-ot),V.__data=new Float32Array(Z.storage/Float32Array.BYTES_PER_ELEMENT),V.__offset=S,S+=Z.storage}}}const T=S%O;return T>0&&(S+=O-T),E.__size=S,E.__cache={},this}function _(E){const y={boundary:0,storage:0};return typeof E=="number"||typeof E=="boolean"?(y.boundary=4,y.storage=4):E.isVector2?(y.boundary=8,y.storage=8):E.isVector3||E.isColor?(y.boundary=16,y.storage=12):E.isVector4?(y.boundary=16,y.storage=16):E.isMatrix3?(y.boundary=48,y.storage=48):E.isMatrix4?(y.boundary=64,y.storage=64):E.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",E),y}function m(E){const y=E.target;y.removeEventListener("dispose",m);const S=a.indexOf(y.__bindingPointIndex);a.splice(S,1),i.deleteBuffer(s[y.id]),delete s[y.id],delete r[y.id]}function d(){for(const E in s)i.deleteBuffer(s[E]);a=[],s={},r={}}return{bind:l,update:c,dispose:d}}class Xg{constructor(t={}){const{canvas:e=Iu(),context:n=null,depth:s=!0,stencil:r=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:f="default",failIfMajorPerformanceCaveat:h=!1,reverseDepthBuffer:u=!1}=t;this.isWebGLRenderer=!0;let p;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");p=n.getContextAttributes().alpha}else p=a;const g=new Uint32Array(4),_=new Int32Array(4);let m=null,d=null;const E=[],y=[];this.domElement=e,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this._outputColorSpace=hn,this.toneMapping=fi,this.toneMappingExposure=1;const S=this;let O=!1,T=0,R=0,I=null,b=-1,M=null;const A=new Re,V=new Re;let z=null;const C=new Tt(0);let W=0,G=e.width,Z=e.height,H=1,it=null,ot=null;const gt=new Re(0,0,G,Z),Ct=new Re(0,0,G,Z);let Jt=!1;const Y=new Yl;let tt=!1,_t=!1;const st=new ue,Lt=new ue,It=new F,zt=new Re,_e={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let qt=!1;function Se(){return I===null?H:1}let U=n;function Ze(v,D){return e.getContext(v,D)}try{const v={alpha:!0,depth:s,stencil:r,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:f,failIfMajorPerformanceCaveat:h};if("setAttribute"in e&&e.setAttribute("data-engine",`three.js r${Ul}`),e.addEventListener("webglcontextlost",j,!1),e.addEventListener("webglcontextrestored",dt,!1),e.addEventListener("webglcontextcreationerror",at,!1),U===null){const D="webgl2";if(U=Ze(D,v),U===null)throw Ze(D)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}}catch(v){throw console.error("THREE.WebGLRenderer: "+v.message),v}let Gt,$t,Et,oe,At,w,x,B,$,J,K,xt,rt,pt,Zt,Q,mt,Dt,ht,ut,jt,Ut,Pt,L;function lt(){Gt=new $p(U),Gt.init(),Ut=new Ng(U,Gt),$t=new Wp(U,Gt,t,Ut),Et=new Dg(U,Gt),$t.reverseDepthBuffer&&u&&Et.buffers.depth.setReversed(!0),oe=new Qp(U),At=new _g,w=new Ug(U,Gt,Et,At,$t,Ut,oe),x=new Yp(S),B=new Kp(S),$=new ad(U),Pt=new Gp(U,$),J=new jp(U,$,oe,Pt),K=new em(U,J,$,oe),ht=new tm(U,$t,w),Q=new Xp(At),xt=new gg(S,x,B,Gt,$t,Pt,Q),rt=new Vg(S,At),pt=new vg,Zt=new wg(Gt),Dt=new Hp(S,x,B,Et,K,p,l),mt=new Pg(S,K,$t),L=new Wg(U,oe,$t,Et),ut=new Vp(U,Gt,oe),jt=new Jp(U,Gt,oe),oe.programs=xt.programs,S.capabilities=$t,S.extensions=Gt,S.properties=At,S.renderLists=pt,S.shadowMap=mt,S.state=Et,S.info=oe}lt();const X=new Hg(S,U);this.xr=X,this.getContext=function(){return U},this.getContextAttributes=function(){return U.getContextAttributes()},this.forceContextLoss=function(){const v=Gt.get("WEBGL_lose_context");v&&v.loseContext()},this.forceContextRestore=function(){const v=Gt.get("WEBGL_lose_context");v&&v.restoreContext()},this.getPixelRatio=function(){return H},this.setPixelRatio=function(v){v!==void 0&&(H=v,this.setSize(G,Z,!1))},this.getSize=function(v){return v.set(G,Z)},this.setSize=function(v,D,k=!0){if(X.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}G=v,Z=D,e.width=Math.floor(v*H),e.height=Math.floor(D*H),k===!0&&(e.style.width=v+"px",e.style.height=D+"px"),this.setViewport(0,0,v,D)},this.getDrawingBufferSize=function(v){return v.set(G*H,Z*H).floor()},this.setDrawingBufferSize=function(v,D,k){G=v,Z=D,H=k,e.width=Math.floor(v*k),e.height=Math.floor(D*k),this.setViewport(0,0,v,D)},this.getCurrentViewport=function(v){return v.copy(A)},this.getViewport=function(v){return v.copy(gt)},this.setViewport=function(v,D,k,P){v.isVector4?gt.set(v.x,v.y,v.z,v.w):gt.set(v,D,k,P),Et.viewport(A.copy(gt).multiplyScalar(H).round())},this.getScissor=function(v){return v.copy(Ct)},this.setScissor=function(v,D,k,P){v.isVector4?Ct.set(v.x,v.y,v.z,v.w):Ct.set(v,D,k,P),Et.scissor(V.copy(Ct).multiplyScalar(H).round())},this.getScissorTest=function(){return Jt},this.setScissorTest=function(v){Et.setScissorTest(Jt=v)},this.setOpaqueSort=function(v){it=v},this.setTransparentSort=function(v){ot=v},this.getClearColor=function(v){return v.copy(Dt.getClearColor())},this.setClearColor=function(){Dt.setClearColor.apply(Dt,arguments)},this.getClearAlpha=function(){return Dt.getClearAlpha()},this.setClearAlpha=function(){Dt.setClearAlpha.apply(Dt,arguments)},this.clear=function(v=!0,D=!0,k=!0){let P=0;if(v){let N=!1;if(I!==null){const et=I.texture.format;N=et===Gl||et===Hl||et===kl}if(N){const et=I.texture.type,ft=et===jn||et===ss||et===Br||et===er||et===Ol||et===Bl,vt=Dt.getClearColor(),St=Dt.getClearAlpha(),Nt=vt.r,Ot=vt.g,yt=vt.b;ft?(g[0]=Nt,g[1]=Ot,g[2]=yt,g[3]=St,U.clearBufferuiv(U.COLOR,0,g)):(_[0]=Nt,_[1]=Ot,_[2]=yt,_[3]=St,U.clearBufferiv(U.COLOR,0,_))}else P|=U.COLOR_BUFFER_BIT}D&&(P|=U.DEPTH_BUFFER_BIT),k&&(P|=U.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),U.clear(P)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){e.removeEventListener("webglcontextlost",j,!1),e.removeEventListener("webglcontextrestored",dt,!1),e.removeEventListener("webglcontextcreationerror",at,!1),pt.dispose(),Zt.dispose(),At.dispose(),x.dispose(),B.dispose(),K.dispose(),Pt.dispose(),L.dispose(),xt.dispose(),X.dispose(),X.removeEventListener("sessionstart",nn),X.removeEventListener("sessionend",ds),sn.stop()};function j(v){v.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),O=!0}function dt(){console.log("THREE.WebGLRenderer: Context Restored."),O=!1;const v=oe.autoReset,D=mt.enabled,k=mt.autoUpdate,P=mt.needsUpdate,N=mt.type;lt(),oe.autoReset=v,mt.enabled=D,mt.autoUpdate=k,mt.needsUpdate=P,mt.type=N}function at(v){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",v.statusMessage)}function Ft(v){const D=v.target;D.removeEventListener("dispose",Ft),ye(D)}function ye(v){Vt(v),At.remove(v)}function Vt(v){const D=At.get(v).programs;D!==void 0&&(D.forEach(function(k){xt.releaseProgram(k)}),v.isShaderMaterial&&xt.releaseShaderCache(v))}this.renderBufferDirect=function(v,D,k,P,N,et){D===null&&(D=_e);const ft=N.isMesh&&N.matrixWorld.determinant()<0,vt=Bi(v,D,k,P,N);Et.setMaterial(P,ft);let St=k.index,Nt=1;if(P.wireframe===!0){if(St=J.getWireframeAttribute(k),St===void 0)return;Nt=2}const Ot=k.drawRange,yt=k.attributes.position;let Qt=Ot.start*Nt,le=(Ot.start+Ot.count)*Nt;et!==null&&(Qt=Math.max(Qt,et.start*Nt),le=Math.min(le,(et.start+et.count)*Nt)),St!==null?(Qt=Math.max(Qt,0),le=Math.min(le,St.count)):yt!=null&&(Qt=Math.max(Qt,0),le=Math.min(le,yt.count));const me=le-Qt;if(me<0||me===1/0)return;Pt.setup(N,P,vt,k,St);let Ke,se=ut;if(St!==null&&(Ke=$.get(St),se=jt,se.setIndex(Ke)),N.isMesh)P.wireframe===!0?(Et.setLineWidth(P.wireframeLinewidth*Se()),se.setMode(U.LINES)):se.setMode(U.TRIANGLES);else if(N.isLine){let Mt=P.linewidth;Mt===void 0&&(Mt=1),Et.setLineWidth(Mt*Se()),N.isLineSegments?se.setMode(U.LINES):N.isLineLoop?se.setMode(U.LINE_LOOP):se.setMode(U.LINE_STRIP)}else N.isPoints?se.setMode(U.POINTS):N.isSprite&&se.setMode(U.TRIANGLES);if(N.isBatchedMesh)if(N._multiDrawInstances!==null)se.renderMultiDrawInstances(N._multiDrawStarts,N._multiDrawCounts,N._multiDrawCount,N._multiDrawInstances);else if(Gt.get("WEBGL_multi_draw"))se.renderMultiDraw(N._multiDrawStarts,N._multiDrawCounts,N._multiDrawCount);else{const Mt=N._multiDrawStarts,wn=N._multiDrawCounts,te=N._multiDrawCount,_n=St?$.get(St).bytesPerElement:1,$e=At.get(P).currentProgram.getUniforms();for(let rn=0;rn<te;rn++)$e.setValue(U,"_gl_DrawID",rn),se.render(Mt[rn]/_n,wn[rn])}else if(N.isInstancedMesh)se.renderInstances(Qt,me,N.count);else if(k.isInstancedBufferGeometry){const Mt=k._maxInstanceCount!==void 0?k._maxInstanceCount:1/0,wn=Math.min(k.instanceCount,Mt);se.renderInstances(Qt,me,wn)}else se.render(Qt,me)};function ie(v,D,k){v.transparent===!0&&v.side===Ln&&v.forceSinglePass===!1?(v.side=vn,v.needsUpdate=!0,de(v,D,k),v.side=Ii,v.needsUpdate=!0,de(v,D,k),v.side=Ln):de(v,D,k)}this.compile=function(v,D,k=null){k===null&&(k=v),d=Zt.get(k),d.init(D),y.push(d),k.traverseVisible(function(N){N.isLight&&N.layers.test(D.layers)&&(d.pushLight(N),N.castShadow&&d.pushShadow(N))}),v!==k&&v.traverseVisible(function(N){N.isLight&&N.layers.test(D.layers)&&(d.pushLight(N),N.castShadow&&d.pushShadow(N))}),d.setupLights();const P=new Set;return v.traverse(function(N){if(!(N.isMesh||N.isPoints||N.isLine||N.isSprite))return;const et=N.material;if(et)if(Array.isArray(et))for(let ft=0;ft<et.length;ft++){const vt=et[ft];ie(vt,k,N),P.add(vt)}else ie(et,k,N),P.add(et)}),y.pop(),d=null,P},this.compileAsync=function(v,D,k=null){const P=this.compile(v,D,k);return new Promise(N=>{function et(){if(P.forEach(function(ft){At.get(ft).currentProgram.isReady()&&P.delete(ft)}),P.size===0){N(v);return}setTimeout(et,10)}Gt.get("KHR_parallel_shader_compile")!==null?et():setTimeout(et,10)})};let en=null;function Pe(v){en&&en(v)}function nn(){sn.stop()}function ds(){sn.start()}const sn=new nf;sn.setAnimationLoop(Pe),typeof self<"u"&&sn.setContext(self),this.setAnimationLoop=function(v){en=v,X.setAnimationLoop(v),v===null?sn.stop():sn.start()},X.addEventListener("sessionstart",nn),X.addEventListener("sessionend",ds),this.render=function(v,D){if(D!==void 0&&D.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(O===!0)return;if(v.matrixWorldAutoUpdate===!0&&v.updateMatrixWorld(),D.parent===null&&D.matrixWorldAutoUpdate===!0&&D.updateMatrixWorld(),X.enabled===!0&&X.isPresenting===!0&&(X.cameraAutoUpdate===!0&&X.updateCamera(D),D=X.getCamera()),v.isScene===!0&&v.onBeforeRender(S,v,D,I),d=Zt.get(v,y.length),d.init(D),y.push(d),Lt.multiplyMatrices(D.projectionMatrix,D.matrixWorldInverse),Y.setFromProjectionMatrix(Lt),_t=this.localClippingEnabled,tt=Q.init(this.clippingPlanes,_t),m=pt.get(v,E.length),m.init(),E.push(m),X.enabled===!0&&X.isPresenting===!0){const et=S.xr.getDepthSensingMesh();et!==null&&Un(et,D,-1/0,S.sortObjects)}Un(v,D,0,S.sortObjects),m.finish(),S.sortObjects===!0&&m.sort(it,ot),qt=X.enabled===!1||X.isPresenting===!1||X.hasDepthSensing()===!1,qt&&Dt.addToRenderList(m,v),this.info.render.frame++,tt===!0&&Q.beginShadows();const k=d.state.shadowsArray;mt.render(k,v,D),tt===!0&&Q.endShadows(),this.info.autoReset===!0&&this.info.reset();const P=m.opaque,N=m.transmissive;if(d.setupLights(),D.isArrayCamera){const et=D.cameras;if(N.length>0)for(let ft=0,vt=et.length;ft<vt;ft++){const St=et[ft];vi(P,N,v,St)}qt&&Dt.render(v);for(let ft=0,vt=et.length;ft<vt;ft++){const St=et[ft];ur(m,v,St,St.viewport)}}else N.length>0&&vi(P,N,v,D),qt&&Dt.render(v),ur(m,v,D);I!==null&&(w.updateMultisampleRenderTarget(I),w.updateRenderTargetMipmap(I)),v.isScene===!0&&v.onAfterRender(S,v,D),Pt.resetDefaultState(),b=-1,M=null,y.pop(),y.length>0?(d=y[y.length-1],tt===!0&&Q.setGlobalState(S.clippingPlanes,d.state.camera)):d=null,E.pop(),E.length>0?m=E[E.length-1]:m=null};function Un(v,D,k,P){if(v.visible===!1)return;if(v.layers.test(D.layers)){if(v.isGroup)k=v.renderOrder;else if(v.isLOD)v.autoUpdate===!0&&v.update(D);else if(v.isLight)d.pushLight(v),v.castShadow&&d.pushShadow(v);else if(v.isSprite){if(!v.frustumCulled||Y.intersectsSprite(v)){P&&zt.setFromMatrixPosition(v.matrixWorld).applyMatrix4(Lt);const ft=K.update(v),vt=v.material;vt.visible&&m.push(v,ft,vt,k,zt.z,null)}}else if((v.isMesh||v.isLine||v.isPoints)&&(!v.frustumCulled||Y.intersectsObject(v))){const ft=K.update(v),vt=v.material;if(P&&(v.boundingSphere!==void 0?(v.boundingSphere===null&&v.computeBoundingSphere(),zt.copy(v.boundingSphere.center)):(ft.boundingSphere===null&&ft.computeBoundingSphere(),zt.copy(ft.boundingSphere.center)),zt.applyMatrix4(v.matrixWorld).applyMatrix4(Lt)),Array.isArray(vt)){const St=ft.groups;for(let Nt=0,Ot=St.length;Nt<Ot;Nt++){const yt=St[Nt],Qt=vt[yt.materialIndex];Qt&&Qt.visible&&m.push(v,ft,Qt,k,zt.z,yt)}}else vt.visible&&m.push(v,ft,vt,k,zt.z,null)}}const et=v.children;for(let ft=0,vt=et.length;ft<vt;ft++)Un(et[ft],D,k,P)}function ur(v,D,k,P){const N=v.opaque,et=v.transmissive,ft=v.transparent;d.setupLightsView(k),tt===!0&&Q.setGlobalState(S.clippingPlanes,k),P&&Et.viewport(A.copy(P)),N.length>0&&Oi(N,D,k),et.length>0&&Oi(et,D,k),ft.length>0&&Oi(ft,D,k),Et.buffers.depth.setTest(!0),Et.buffers.depth.setMask(!0),Et.buffers.color.setMask(!0),Et.setPolygonOffset(!1)}function vi(v,D,k,P){if((k.isScene===!0?k.overrideMaterial:null)!==null)return;d.state.transmissionRenderTarget[P.id]===void 0&&(d.state.transmissionRenderTarget[P.id]=new Ui(1,1,{generateMipmaps:!0,type:Gt.has("EXT_color_buffer_half_float")||Gt.has("EXT_color_buffer_float")?ar:jn,minFilter:Pi,samples:4,stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:ae.workingColorSpace}));const et=d.state.transmissionRenderTarget[P.id],ft=P.viewport||A;et.setSize(ft.z,ft.w);const vt=S.getRenderTarget();S.setRenderTarget(et),S.getClearColor(C),W=S.getClearAlpha(),W<1&&S.setClearColor(16777215,.5),S.clear(),qt&&Dt.render(k);const St=S.toneMapping;S.toneMapping=fi;const Nt=P.viewport;if(P.viewport!==void 0&&(P.viewport=void 0),d.setupLightsView(P),tt===!0&&Q.setGlobalState(S.clippingPlanes,P),Oi(v,k,P),w.updateMultisampleRenderTarget(et),w.updateRenderTargetMipmap(et),Gt.has("WEBGL_multisampled_render_to_texture")===!1){let Ot=!1;for(let yt=0,Qt=D.length;yt<Qt;yt++){const le=D[yt],me=le.object,Ke=le.geometry,se=le.material,Mt=le.group;if(se.side===Ln&&me.layers.test(P.layers)){const wn=se.side;se.side=vn,se.needsUpdate=!0,dr(me,k,P,Ke,se,Mt),se.side=wn,se.needsUpdate=!0,Ot=!0}}Ot===!0&&(w.updateMultisampleRenderTarget(et),w.updateRenderTargetMipmap(et))}S.setRenderTarget(vt),S.setClearColor(C,W),Nt!==void 0&&(P.viewport=Nt),S.toneMapping=St}function Oi(v,D,k){const P=D.isScene===!0?D.overrideMaterial:null;for(let N=0,et=v.length;N<et;N++){const ft=v[N],vt=ft.object,St=ft.geometry,Nt=P===null?ft.material:P,Ot=ft.group;vt.layers.test(k.layers)&&dr(vt,D,k,St,Nt,Ot)}}function dr(v,D,k,P,N,et){v.onBeforeRender(S,D,k,P,N,et),v.modelViewMatrix.multiplyMatrices(k.matrixWorldInverse,v.matrixWorld),v.normalMatrix.getNormalMatrix(v.modelViewMatrix),N.onBeforeRender(S,D,k,P,v,et),N.transparent===!0&&N.side===Ln&&N.forceSinglePass===!1?(N.side=vn,N.needsUpdate=!0,S.renderBufferDirect(k,D,P,N,v,et),N.side=Ii,N.needsUpdate=!0,S.renderBufferDirect(k,D,P,N,v,et),N.side=Ln):S.renderBufferDirect(k,D,P,N,v,et),v.onAfterRender(S,D,k,P,N,et)}function de(v,D,k){D.isScene!==!0&&(D=_e);const P=At.get(v),N=d.state.lights,et=d.state.shadowsArray,ft=N.state.version,vt=xt.getParameters(v,N.state,et,D,k),St=xt.getProgramCacheKey(vt);let Nt=P.programs;P.environment=v.isMeshStandardMaterial?D.environment:null,P.fog=D.fog,P.envMap=(v.isMeshStandardMaterial?B:x).get(v.envMap||P.environment),P.envMapRotation=P.environment!==null&&v.envMap===null?D.environmentRotation:v.envMapRotation,Nt===void 0&&(v.addEventListener("dispose",Ft),Nt=new Map,P.programs=Nt);let Ot=Nt.get(St);if(Ot!==void 0){if(P.currentProgram===Ot&&P.lightsStateVersion===ft)return Le(v,vt),Ot}else vt.uniforms=xt.getUniforms(v),v.onBeforeCompile(vt,S),Ot=xt.acquireProgram(vt,St),Nt.set(St,Ot),P.uniforms=vt.uniforms;const yt=P.uniforms;return(!v.isShaderMaterial&&!v.isRawShaderMaterial||v.clipping===!0)&&(yt.clippingPlanes=Q.uniform),Le(v,vt),P.needsLights=pr(v),P.lightsStateVersion=ft,P.needsLights&&(yt.ambientLightColor.value=N.state.ambient,yt.lightProbe.value=N.state.probe,yt.directionalLights.value=N.state.directional,yt.directionalLightShadows.value=N.state.directionalShadow,yt.spotLights.value=N.state.spot,yt.spotLightShadows.value=N.state.spotShadow,yt.rectAreaLights.value=N.state.rectArea,yt.ltc_1.value=N.state.rectAreaLTC1,yt.ltc_2.value=N.state.rectAreaLTC2,yt.pointLights.value=N.state.point,yt.pointLightShadows.value=N.state.pointShadow,yt.hemisphereLights.value=N.state.hemi,yt.directionalShadowMap.value=N.state.directionalShadowMap,yt.directionalShadowMatrix.value=N.state.directionalShadowMatrix,yt.spotShadowMap.value=N.state.spotShadowMap,yt.spotLightMatrix.value=N.state.spotLightMatrix,yt.spotLightMap.value=N.state.spotLightMap,yt.pointShadowMap.value=N.state.pointShadowMap,yt.pointShadowMatrix.value=N.state.pointShadowMatrix),P.currentProgram=Ot,P.uniformsList=null,Ot}function pe(v){if(v.uniformsList===null){const D=v.currentProgram.getUniforms();v.uniformsList=Ia.seqWithValue(D.seq,v.uniforms)}return v.uniformsList}function Le(v,D){const k=At.get(v);k.outputColorSpace=D.outputColorSpace,k.batching=D.batching,k.batchingColor=D.batchingColor,k.instancing=D.instancing,k.instancingColor=D.instancingColor,k.instancingMorph=D.instancingMorph,k.skinning=D.skinning,k.morphTargets=D.morphTargets,k.morphNormals=D.morphNormals,k.morphColors=D.morphColors,k.morphTargetsCount=D.morphTargetsCount,k.numClippingPlanes=D.numClippingPlanes,k.numIntersection=D.numClipIntersection,k.vertexAlphas=D.vertexAlphas,k.vertexTangents=D.vertexTangents,k.toneMapping=D.toneMapping}function Bi(v,D,k,P,N){D.isScene!==!0&&(D=_e),w.resetTextureUnits();const et=D.fog,ft=P.isMeshStandardMaterial?D.environment:null,vt=I===null?S.outputColorSpace:I.isXRRenderTarget===!0?I.texture.colorSpace:ls,St=(P.isMeshStandardMaterial?B:x).get(P.envMap||ft),Nt=P.vertexColors===!0&&!!k.attributes.color&&k.attributes.color.itemSize===4,Ot=!!k.attributes.tangent&&(!!P.normalMap||P.anisotropy>0),yt=!!k.morphAttributes.position,Qt=!!k.morphAttributes.normal,le=!!k.morphAttributes.color;let me=fi;P.toneMapped&&(I===null||I.isXRRenderTarget===!0)&&(me=S.toneMapping);const Ke=k.morphAttributes.position||k.morphAttributes.normal||k.morphAttributes.color,se=Ke!==void 0?Ke.length:0,Mt=At.get(P),wn=d.state.lights;if(tt===!0&&(_t===!0||v!==M)){const ce=v===M&&P.id===b;Q.setState(P,v,ce)}let te=!1;P.version===Mt.__version?(Mt.needsLights&&Mt.lightsStateVersion!==wn.state.version||Mt.outputColorSpace!==vt||N.isBatchedMesh&&Mt.batching===!1||!N.isBatchedMesh&&Mt.batching===!0||N.isBatchedMesh&&Mt.batchingColor===!0&&N.colorTexture===null||N.isBatchedMesh&&Mt.batchingColor===!1&&N.colorTexture!==null||N.isInstancedMesh&&Mt.instancing===!1||!N.isInstancedMesh&&Mt.instancing===!0||N.isSkinnedMesh&&Mt.skinning===!1||!N.isSkinnedMesh&&Mt.skinning===!0||N.isInstancedMesh&&Mt.instancingColor===!0&&N.instanceColor===null||N.isInstancedMesh&&Mt.instancingColor===!1&&N.instanceColor!==null||N.isInstancedMesh&&Mt.instancingMorph===!0&&N.morphTexture===null||N.isInstancedMesh&&Mt.instancingMorph===!1&&N.morphTexture!==null||Mt.envMap!==St||P.fog===!0&&Mt.fog!==et||Mt.numClippingPlanes!==void 0&&(Mt.numClippingPlanes!==Q.numPlanes||Mt.numIntersection!==Q.numIntersection)||Mt.vertexAlphas!==Nt||Mt.vertexTangents!==Ot||Mt.morphTargets!==yt||Mt.morphNormals!==Qt||Mt.morphColors!==le||Mt.toneMapping!==me||Mt.morphTargetsCount!==se)&&(te=!0):(te=!0,Mt.__version=P.version);let _n=Mt.currentProgram;te===!0&&(_n=de(P,D,N));let $e=!1,rn=!1,Wn=!1;const xe=_n.getUniforms(),ve=Mt.uniforms;if(Et.useProgram(_n.program)&&($e=!0,rn=!0,Wn=!0),P.id!==b&&(b=P.id,rn=!0),$e||M!==v){Et.buffers.depth.getReversed()?(st.copy(v.projectionMatrix),Nu(st),Fu(st),xe.setValue(U,"projectionMatrix",st)):xe.setValue(U,"projectionMatrix",v.projectionMatrix),xe.setValue(U,"viewMatrix",v.matrixWorldInverse);const Tn=xe.map.cameraPosition;Tn!==void 0&&Tn.setValue(U,It.setFromMatrixPosition(v.matrixWorld)),$t.logarithmicDepthBuffer&&xe.setValue(U,"logDepthBufFC",2/(Math.log(v.far+1)/Math.LN2)),(P.isMeshPhongMaterial||P.isMeshToonMaterial||P.isMeshLambertMaterial||P.isMeshBasicMaterial||P.isMeshStandardMaterial||P.isShaderMaterial)&&xe.setValue(U,"isOrthographic",v.isOrthographicCamera===!0),M!==v&&(M=v,rn=!0,Wn=!0)}if(N.isSkinnedMesh){xe.setOptional(U,N,"bindMatrix"),xe.setOptional(U,N,"bindMatrixInverse");const ce=N.skeleton;ce&&(ce.boneTexture===null&&ce.computeBoneTexture(),xe.setValue(U,"boneTexture",ce.boneTexture,w))}N.isBatchedMesh&&(xe.setOptional(U,N,"batchingTexture"),xe.setValue(U,"batchingTexture",N._matricesTexture,w),xe.setOptional(U,N,"batchingIdTexture"),xe.setValue(U,"batchingIdTexture",N._indirectTexture,w),xe.setOptional(U,N,"batchingColorTexture"),N._colorsTexture!==null&&xe.setValue(U,"batchingColorTexture",N._colorsTexture,w));const Qn=k.morphAttributes;if((Qn.position!==void 0||Qn.normal!==void 0||Qn.color!==void 0)&&ht.update(N,k,_n),(rn||Mt.receiveShadow!==N.receiveShadow)&&(Mt.receiveShadow=N.receiveShadow,xe.setValue(U,"receiveShadow",N.receiveShadow)),P.isMeshGouraudMaterial&&P.envMap!==null&&(ve.envMap.value=St,ve.flipEnvMap.value=St.isCubeTexture&&St.isRenderTargetTexture===!1?-1:1),P.isMeshStandardMaterial&&P.envMap===null&&D.environment!==null&&(ve.envMapIntensity.value=D.environmentIntensity),rn&&(xe.setValue(U,"toneMappingExposure",S.toneMappingExposure),Mt.needsLights&&Xr(ve,Wn),et&&P.fog===!0&&rt.refreshFogUniforms(ve,et),rt.refreshMaterialUniforms(ve,P,H,Z,d.state.transmissionRenderTarget[v.id]),Ia.upload(U,pe(Mt),ve,w)),P.isShaderMaterial&&P.uniformsNeedUpdate===!0&&(Ia.upload(U,pe(Mt),ve,w),P.uniformsNeedUpdate=!1),P.isSpriteMaterial&&xe.setValue(U,"center",N.center),xe.setValue(U,"modelViewMatrix",N.modelViewMatrix),xe.setValue(U,"normalMatrix",N.normalMatrix),xe.setValue(U,"modelMatrix",N.matrixWorld),P.isShaderMaterial||P.isRawShaderMaterial){const ce=P.uniformsGroups;for(let Tn=0,Nn=ce.length;Tn<Nn;Tn++){const nt=ce[Tn];L.update(nt,_n),L.bind(nt,_n)}}return _n}function Xr(v,D){v.ambientLightColor.needsUpdate=D,v.lightProbe.needsUpdate=D,v.directionalLights.needsUpdate=D,v.directionalLightShadows.needsUpdate=D,v.pointLights.needsUpdate=D,v.pointLightShadows.needsUpdate=D,v.spotLights.needsUpdate=D,v.spotLightShadows.needsUpdate=D,v.rectAreaLights.needsUpdate=D,v.hemisphereLights.needsUpdate=D}function pr(v){return v.isMeshLambertMaterial||v.isMeshToonMaterial||v.isMeshPhongMaterial||v.isMeshStandardMaterial||v.isShadowMaterial||v.isShaderMaterial&&v.lights===!0}this.getActiveCubeFace=function(){return T},this.getActiveMipmapLevel=function(){return R},this.getRenderTarget=function(){return I},this.setRenderTargetTextures=function(v,D,k){At.get(v.texture).__webglTexture=D,At.get(v.depthTexture).__webglTexture=k;const P=At.get(v);P.__hasExternalTextures=!0,P.__autoAllocateDepthBuffer=k===void 0,P.__autoAllocateDepthBuffer||Gt.has("WEBGL_multisampled_render_to_texture")===!0&&(console.warn("THREE.WebGLRenderer: Render-to-texture extension was disabled because an external texture was provided"),P.__useRenderToTexture=!1)},this.setRenderTargetFramebuffer=function(v,D){const k=At.get(v);k.__webglFramebuffer=D,k.__useDefaultFramebuffer=D===void 0},this.setRenderTarget=function(v,D=0,k=0){I=v,T=D,R=k;let P=!0,N=null,et=!1,ft=!1;if(v){const St=At.get(v);if(St.__useDefaultFramebuffer!==void 0)Et.bindFramebuffer(U.FRAMEBUFFER,null),P=!1;else if(St.__webglFramebuffer===void 0)w.setupRenderTarget(v);else if(St.__hasExternalTextures)w.rebindTextures(v,At.get(v.texture).__webglTexture,At.get(v.depthTexture).__webglTexture);else if(v.depthBuffer){const yt=v.depthTexture;if(St.__boundDepthTexture!==yt){if(yt!==null&&At.has(yt)&&(v.width!==yt.image.width||v.height!==yt.image.height))throw new Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");w.setupDepthRenderbuffer(v)}}const Nt=v.texture;(Nt.isData3DTexture||Nt.isDataArrayTexture||Nt.isCompressedArrayTexture)&&(ft=!0);const Ot=At.get(v).__webglFramebuffer;v.isWebGLCubeRenderTarget?(Array.isArray(Ot[D])?N=Ot[D][k]:N=Ot[D],et=!0):v.samples>0&&w.useMultisampledRTT(v)===!1?N=At.get(v).__webglMultisampledFramebuffer:Array.isArray(Ot)?N=Ot[k]:N=Ot,A.copy(v.viewport),V.copy(v.scissor),z=v.scissorTest}else A.copy(gt).multiplyScalar(H).floor(),V.copy(Ct).multiplyScalar(H).floor(),z=Jt;if(Et.bindFramebuffer(U.FRAMEBUFFER,N)&&P&&Et.drawBuffers(v,N),Et.viewport(A),Et.scissor(V),Et.setScissorTest(z),et){const St=At.get(v.texture);U.framebufferTexture2D(U.FRAMEBUFFER,U.COLOR_ATTACHMENT0,U.TEXTURE_CUBE_MAP_POSITIVE_X+D,St.__webglTexture,k)}else if(ft){const St=At.get(v.texture),Nt=D||0;U.framebufferTextureLayer(U.FRAMEBUFFER,U.COLOR_ATTACHMENT0,St.__webglTexture,k||0,Nt)}b=-1},this.readRenderTargetPixels=function(v,D,k,P,N,et,ft){if(!(v&&v.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let vt=At.get(v).__webglFramebuffer;if(v.isWebGLCubeRenderTarget&&ft!==void 0&&(vt=vt[ft]),vt){Et.bindFramebuffer(U.FRAMEBUFFER,vt);try{const St=v.texture,Nt=St.format,Ot=St.type;if(!$t.textureFormatReadable(Nt)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!$t.textureTypeReadable(Ot)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}D>=0&&D<=v.width-P&&k>=0&&k<=v.height-N&&U.readPixels(D,k,P,N,Ut.convert(Nt),Ut.convert(Ot),et)}finally{const St=I!==null?At.get(I).__webglFramebuffer:null;Et.bindFramebuffer(U.FRAMEBUFFER,St)}}},this.readRenderTargetPixelsAsync=async function(v,D,k,P,N,et,ft){if(!(v&&v.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let vt=At.get(v).__webglFramebuffer;if(v.isWebGLCubeRenderTarget&&ft!==void 0&&(vt=vt[ft]),vt){const St=v.texture,Nt=St.format,Ot=St.type;if(!$t.textureFormatReadable(Nt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!$t.textureTypeReadable(Ot))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");if(D>=0&&D<=v.width-P&&k>=0&&k<=v.height-N){Et.bindFramebuffer(U.FRAMEBUFFER,vt);const yt=U.createBuffer();U.bindBuffer(U.PIXEL_PACK_BUFFER,yt),U.bufferData(U.PIXEL_PACK_BUFFER,et.byteLength,U.STREAM_READ),U.readPixels(D,k,P,N,Ut.convert(Nt),Ut.convert(Ot),0);const Qt=I!==null?At.get(I).__webglFramebuffer:null;Et.bindFramebuffer(U.FRAMEBUFFER,Qt);const le=U.fenceSync(U.SYNC_GPU_COMMANDS_COMPLETE,0);return U.flush(),await Uu(U,le,4),U.bindBuffer(U.PIXEL_PACK_BUFFER,yt),U.getBufferSubData(U.PIXEL_PACK_BUFFER,0,et),U.deleteBuffer(yt),U.deleteSync(le),et}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")}},this.copyFramebufferToTexture=function(v,D=null,k=0){v.isTexture!==!0&&(Ur("WebGLRenderer: copyFramebufferToTexture function signature has changed."),D=arguments[0]||null,v=arguments[1]);const P=Math.pow(2,-k),N=Math.floor(v.image.width*P),et=Math.floor(v.image.height*P),ft=D!==null?D.x:0,vt=D!==null?D.y:0;w.setTexture2D(v,0),U.copyTexSubImage2D(U.TEXTURE_2D,k,0,0,ft,vt,N,et),Et.unbindTexture()},this.copyTextureToTexture=function(v,D,k=null,P=null,N=0){v.isTexture!==!0&&(Ur("WebGLRenderer: copyTextureToTexture function signature has changed."),P=arguments[0]||null,v=arguments[1],D=arguments[2],N=arguments[3]||0,k=null);let et,ft,vt,St,Nt,Ot,yt,Qt,le;const me=v.isCompressedTexture?v.mipmaps[N]:v.image;k!==null?(et=k.max.x-k.min.x,ft=k.max.y-k.min.y,vt=k.isBox3?k.max.z-k.min.z:1,St=k.min.x,Nt=k.min.y,Ot=k.isBox3?k.min.z:0):(et=me.width,ft=me.height,vt=me.depth||1,St=0,Nt=0,Ot=0),P!==null?(yt=P.x,Qt=P.y,le=P.z):(yt=0,Qt=0,le=0);const Ke=Ut.convert(D.format),se=Ut.convert(D.type);let Mt;D.isData3DTexture?(w.setTexture3D(D,0),Mt=U.TEXTURE_3D):D.isDataArrayTexture||D.isCompressedArrayTexture?(w.setTexture2DArray(D,0),Mt=U.TEXTURE_2D_ARRAY):(w.setTexture2D(D,0),Mt=U.TEXTURE_2D),U.pixelStorei(U.UNPACK_FLIP_Y_WEBGL,D.flipY),U.pixelStorei(U.UNPACK_PREMULTIPLY_ALPHA_WEBGL,D.premultiplyAlpha),U.pixelStorei(U.UNPACK_ALIGNMENT,D.unpackAlignment);const wn=U.getParameter(U.UNPACK_ROW_LENGTH),te=U.getParameter(U.UNPACK_IMAGE_HEIGHT),_n=U.getParameter(U.UNPACK_SKIP_PIXELS),$e=U.getParameter(U.UNPACK_SKIP_ROWS),rn=U.getParameter(U.UNPACK_SKIP_IMAGES);U.pixelStorei(U.UNPACK_ROW_LENGTH,me.width),U.pixelStorei(U.UNPACK_IMAGE_HEIGHT,me.height),U.pixelStorei(U.UNPACK_SKIP_PIXELS,St),U.pixelStorei(U.UNPACK_SKIP_ROWS,Nt),U.pixelStorei(U.UNPACK_SKIP_IMAGES,Ot);const Wn=v.isDataArrayTexture||v.isData3DTexture,xe=D.isDataArrayTexture||D.isData3DTexture;if(v.isRenderTargetTexture||v.isDepthTexture){const ve=At.get(v),Qn=At.get(D),ce=At.get(ve.__renderTarget),Tn=At.get(Qn.__renderTarget);Et.bindFramebuffer(U.READ_FRAMEBUFFER,ce.__webglFramebuffer),Et.bindFramebuffer(U.DRAW_FRAMEBUFFER,Tn.__webglFramebuffer);for(let Nn=0;Nn<vt;Nn++)Wn&&U.framebufferTextureLayer(U.READ_FRAMEBUFFER,U.COLOR_ATTACHMENT0,At.get(v).__webglTexture,N,Ot+Nn),v.isDepthTexture?(xe&&U.framebufferTextureLayer(U.DRAW_FRAMEBUFFER,U.COLOR_ATTACHMENT0,At.get(D).__webglTexture,N,le+Nn),U.blitFramebuffer(St,Nt,et,ft,yt,Qt,et,ft,U.DEPTH_BUFFER_BIT,U.NEAREST)):xe?U.copyTexSubImage3D(Mt,N,yt,Qt,le+Nn,St,Nt,et,ft):U.copyTexSubImage2D(Mt,N,yt,Qt,le+Nn,St,Nt,et,ft);Et.bindFramebuffer(U.READ_FRAMEBUFFER,null),Et.bindFramebuffer(U.DRAW_FRAMEBUFFER,null)}else xe?v.isDataTexture||v.isData3DTexture?U.texSubImage3D(Mt,N,yt,Qt,le,et,ft,vt,Ke,se,me.data):D.isCompressedArrayTexture?U.compressedTexSubImage3D(Mt,N,yt,Qt,le,et,ft,vt,Ke,me.data):U.texSubImage3D(Mt,N,yt,Qt,le,et,ft,vt,Ke,se,me):v.isDataTexture?U.texSubImage2D(U.TEXTURE_2D,N,yt,Qt,et,ft,Ke,se,me.data):v.isCompressedTexture?U.compressedTexSubImage2D(U.TEXTURE_2D,N,yt,Qt,me.width,me.height,Ke,me.data):U.texSubImage2D(U.TEXTURE_2D,N,yt,Qt,et,ft,Ke,se,me);U.pixelStorei(U.UNPACK_ROW_LENGTH,wn),U.pixelStorei(U.UNPACK_IMAGE_HEIGHT,te),U.pixelStorei(U.UNPACK_SKIP_PIXELS,_n),U.pixelStorei(U.UNPACK_SKIP_ROWS,$e),U.pixelStorei(U.UNPACK_SKIP_IMAGES,rn),N===0&&D.generateMipmaps&&U.generateMipmap(Mt),Et.unbindTexture()},this.copyTextureToTexture3D=function(v,D,k=null,P=null,N=0){return v.isTexture!==!0&&(Ur("WebGLRenderer: copyTextureToTexture3D function signature has changed."),k=arguments[0]||null,P=arguments[1]||null,v=arguments[2],D=arguments[3],N=arguments[4]||0),Ur('WebGLRenderer: copyTextureToTexture3D function has been deprecated. Use "copyTextureToTexture" instead.'),this.copyTextureToTexture(v,D,k,P,N)},this.initRenderTarget=function(v){At.get(v).__webglFramebuffer===void 0&&w.setupRenderTarget(v)},this.initTexture=function(v){v.isCubeTexture?w.setTextureCube(v,0):v.isData3DTexture?w.setTexture3D(v,0):v.isDataArrayTexture||v.isCompressedArrayTexture?w.setTexture2DArray(v,0):w.setTexture2D(v,0),Et.unbindTexture()},this.resetState=function(){T=0,R=0,I=null,Et.reset(),Pt.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return hi}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(t){this._outputColorSpace=t;const e=this.getContext();e.drawingBufferColorspace=ae._getDrawingBufferColorSpace(t),e.unpackColorSpace=ae._getUnpackColorSpace()}}class lf extends Oe{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new In,this.environmentIntensity=1,this.environmentRotation=new In,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(t,e){return super.copy(t,e),t.background!==null&&(this.background=t.background.clone()),t.environment!==null&&(this.environment=t.environment.clone()),t.fog!==null&&(this.fog=t.fog.clone()),this.backgroundBlurriness=t.backgroundBlurriness,this.backgroundIntensity=t.backgroundIntensity,this.backgroundRotation.copy(t.backgroundRotation),this.environmentIntensity=t.environmentIntensity,this.environmentRotation.copy(t.environmentRotation),t.overrideMaterial!==null&&(this.overrideMaterial=t.overrideMaterial.clone()),this.matrixAutoUpdate=t.matrixAutoUpdate,this}toJSON(t){const e=super.toJSON(t);return this.fog!==null&&(e.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(e.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(e.object.backgroundIntensity=this.backgroundIntensity),e.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(e.object.environmentIntensity=this.environmentIntensity),e.object.environmentRotation=this.environmentRotation.toArray(),e}}class Yg{constructor(t,e){this.isInterleavedBuffer=!0,this.array=t,this.stride=e,this.count=t!==void 0?t.length/e:0,this.usage=yl,this.updateRanges=[],this.version=0,this.uuid=ui()}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.array=new t.array.constructor(t.array),this.count=t.count,this.stride=t.stride,this.usage=t.usage,this}copyAt(t,e,n){t*=this.stride,n*=e.stride;for(let s=0,r=this.stride;s<r;s++)this.array[t+s]=e.array[n+s];return this}set(t,e=0){return this.array.set(t,e),this}clone(t){t.arrayBuffers===void 0&&(t.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=ui()),t.arrayBuffers[this.array.buffer._uuid]===void 0&&(t.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);const e=new this.array.constructor(t.arrayBuffers[this.array.buffer._uuid]),n=new this.constructor(e,this.stride);return n.setUsage(this.usage),n}onUpload(t){return this.onUploadCallback=t,this}toJSON(t){return t.arrayBuffers===void 0&&(t.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=ui()),t.arrayBuffers[this.array.buffer._uuid]===void 0&&(t.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer))),{uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride}}}const an=new F;class za{constructor(t,e,n,s=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=t,this.itemSize=e,this.offset=n,this.normalized=s}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(t){this.data.needsUpdate=t}applyMatrix4(t){for(let e=0,n=this.data.count;e<n;e++)an.fromBufferAttribute(this,e),an.applyMatrix4(t),this.setXYZ(e,an.x,an.y,an.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)an.fromBufferAttribute(this,e),an.applyNormalMatrix(t),this.setXYZ(e,an.x,an.y,an.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)an.fromBufferAttribute(this,e),an.transformDirection(t),this.setXYZ(e,an.x,an.y,an.z);return this}getComponent(t,e){let n=this.array[t*this.data.stride+this.offset+e];return this.normalized&&(n=kn(n,this.array)),n}setComponent(t,e,n){return this.normalized&&(n=fe(n,this.array)),this.data.array[t*this.data.stride+this.offset+e]=n,this}setX(t,e){return this.normalized&&(e=fe(e,this.array)),this.data.array[t*this.data.stride+this.offset]=e,this}setY(t,e){return this.normalized&&(e=fe(e,this.array)),this.data.array[t*this.data.stride+this.offset+1]=e,this}setZ(t,e){return this.normalized&&(e=fe(e,this.array)),this.data.array[t*this.data.stride+this.offset+2]=e,this}setW(t,e){return this.normalized&&(e=fe(e,this.array)),this.data.array[t*this.data.stride+this.offset+3]=e,this}getX(t){let e=this.data.array[t*this.data.stride+this.offset];return this.normalized&&(e=kn(e,this.array)),e}getY(t){let e=this.data.array[t*this.data.stride+this.offset+1];return this.normalized&&(e=kn(e,this.array)),e}getZ(t){let e=this.data.array[t*this.data.stride+this.offset+2];return this.normalized&&(e=kn(e,this.array)),e}getW(t){let e=this.data.array[t*this.data.stride+this.offset+3];return this.normalized&&(e=kn(e,this.array)),e}setXY(t,e,n){return t=t*this.data.stride+this.offset,this.normalized&&(e=fe(e,this.array),n=fe(n,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=n,this}setXYZ(t,e,n,s){return t=t*this.data.stride+this.offset,this.normalized&&(e=fe(e,this.array),n=fe(n,this.array),s=fe(s,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=n,this.data.array[t+2]=s,this}setXYZW(t,e,n,s,r){return t=t*this.data.stride+this.offset,this.normalized&&(e=fe(e,this.array),n=fe(n,this.array),s=fe(s,this.array),r=fe(r,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=n,this.data.array[t+2]=s,this.data.array[t+3]=r,this}clone(t){if(t===void 0){console.log("THREE.InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");const e=[];for(let n=0;n<this.count;n++){const s=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)e.push(this.data.array[s+r])}return new mn(new this.array.constructor(e),this.itemSize,this.normalized)}else return t.interleavedBuffers===void 0&&(t.interleavedBuffers={}),t.interleavedBuffers[this.data.uuid]===void 0&&(t.interleavedBuffers[this.data.uuid]=this.data.clone(t)),new za(t.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(t){if(t===void 0){console.log("THREE.InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");const e=[];for(let n=0;n<this.count;n++){const s=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)e.push(this.data.array[s+r])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:e,normalized:this.normalized}}else return t.interleavedBuffers===void 0&&(t.interleavedBuffers={}),t.interleavedBuffers[this.data.uuid]===void 0&&(t.interleavedBuffers[this.data.uuid]=this.data.toJSON(t)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}}class cf extends fs{static get type(){return"SpriteMaterial"}constructor(t){super(),this.isSpriteMaterial=!0,this.color=new Tt(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.alphaMap=t.alphaMap,this.rotation=t.rotation,this.sizeAttenuation=t.sizeAttenuation,this.fog=t.fog,this}}let Rs;const Mr=new F,Cs=new F,Ps=new F,Ls=new Yt,Sr=new Yt,hf=new ue,pa=new F,yr=new F,ma=new F,th=new Yt,To=new Yt,eh=new Yt;class qg extends Oe{constructor(t=new cf){if(super(),this.isSprite=!0,this.type="Sprite",Rs===void 0){Rs=new Ge;const e=new Float32Array([-.5,-.5,0,0,0,.5,-.5,0,1,0,.5,.5,0,1,1,-.5,.5,0,0,1]),n=new Yg(e,5);Rs.setIndex([0,1,2,0,2,3]),Rs.setAttribute("position",new za(n,3,0,!1)),Rs.setAttribute("uv",new za(n,2,3,!1))}this.geometry=Rs,this.material=t,this.center=new Yt(.5,.5)}raycast(t,e){t.camera===null&&console.error('THREE.Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.'),Cs.setFromMatrixScale(this.matrixWorld),hf.copy(t.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(t.camera.matrixWorldInverse,this.matrixWorld),Ps.setFromMatrixPosition(this.modelViewMatrix),t.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1&&Cs.multiplyScalar(-Ps.z);const n=this.material.rotation;let s,r;n!==0&&(r=Math.cos(n),s=Math.sin(n));const a=this.center;ga(pa.set(-.5,-.5,0),Ps,a,Cs,s,r),ga(yr.set(.5,-.5,0),Ps,a,Cs,s,r),ga(ma.set(.5,.5,0),Ps,a,Cs,s,r),th.set(0,0),To.set(1,0),eh.set(1,1);let o=t.ray.intersectTriangle(pa,yr,ma,!1,Mr);if(o===null&&(ga(yr.set(-.5,.5,0),Ps,a,Cs,s,r),To.set(0,1),o=t.ray.intersectTriangle(pa,ma,yr,!1,Mr),o===null))return;const l=t.ray.origin.distanceTo(Mr);l<t.near||l>t.far||e.push({distance:l,point:Mr.clone(),uv:Dn.getInterpolation(Mr,pa,yr,ma,th,To,eh,new Yt),face:null,object:this})}copy(t,e){return super.copy(t,e),t.center!==void 0&&this.center.copy(t.center),this.material=t.material,this}}function ga(i,t,e,n,s,r){Ls.subVectors(i,e).addScalar(.5).multiply(n),s!==void 0?(Sr.x=r*Ls.x-s*Ls.y,Sr.y=s*Ls.x+r*Ls.y):Sr.copy(Ls),i.copy(t),i.x+=Sr.x,i.y+=Sr.y,i.applyMatrix4(hf)}class Zg extends tn{constructor(t=null,e=1,n=1,s,r,a,o,l,c=Ne,f=Ne,h,u){super(null,a,o,l,c,f,s,r,h,u),this.isDataTexture=!0,this.image={data:t,width:e,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class wl extends mn{constructor(t,e,n,s=1){super(t,e,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=s}copy(t){return super.copy(t),this.meshPerAttribute=t.meshPerAttribute,this}toJSON(){const t=super.toJSON();return t.meshPerAttribute=this.meshPerAttribute,t.isInstancedBufferAttribute=!0,t}}const Ds=new ue,nh=new ue,_a=[],ih=new hs,Kg=new ue,br=new Rt,Er=new lr;class Ua extends Rt{constructor(t,e,n){super(t,e),this.isInstancedMesh=!0,this.instanceMatrix=new wl(new Float32Array(n*16),16),this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let s=0;s<n;s++)this.setMatrixAt(s,Kg)}computeBoundingBox(){const t=this.geometry,e=this.count;this.boundingBox===null&&(this.boundingBox=new hs),t.boundingBox===null&&t.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,Ds),ih.copy(t.boundingBox).applyMatrix4(Ds),this.boundingBox.union(ih)}computeBoundingSphere(){const t=this.geometry,e=this.count;this.boundingSphere===null&&(this.boundingSphere=new lr),t.boundingSphere===null&&t.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,Ds),Er.copy(t.boundingSphere).applyMatrix4(Ds),this.boundingSphere.union(Er)}copy(t,e){return super.copy(t,e),this.instanceMatrix.copy(t.instanceMatrix),t.morphTexture!==null&&(this.morphTexture=t.morphTexture.clone()),t.instanceColor!==null&&(this.instanceColor=t.instanceColor.clone()),this.count=t.count,t.boundingBox!==null&&(this.boundingBox=t.boundingBox.clone()),t.boundingSphere!==null&&(this.boundingSphere=t.boundingSphere.clone()),this}getColorAt(t,e){e.fromArray(this.instanceColor.array,t*3)}getMatrixAt(t,e){e.fromArray(this.instanceMatrix.array,t*16)}getMorphAt(t,e){const n=e.morphTargetInfluences,s=this.morphTexture.source.data.data,r=n.length+1,a=t*r+1;for(let o=0;o<n.length;o++)n[o]=s[a+o]}raycast(t,e){const n=this.matrixWorld,s=this.count;if(br.geometry=this.geometry,br.material=this.material,br.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Er.copy(this.boundingSphere),Er.applyMatrix4(n),t.ray.intersectsSphere(Er)!==!1))for(let r=0;r<s;r++){this.getMatrixAt(r,Ds),nh.multiplyMatrices(n,Ds),br.matrixWorld=nh,br.raycast(t,_a);for(let a=0,o=_a.length;a<o;a++){const l=_a[a];l.instanceId=r,l.object=this,e.push(l)}_a.length=0}}setColorAt(t,e){this.instanceColor===null&&(this.instanceColor=new wl(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),e.toArray(this.instanceColor.array,t*3)}setMatrixAt(t,e){e.toArray(this.instanceMatrix.array,t*16)}setMorphAt(t,e){const n=e.morphTargetInfluences,s=n.length+1;this.morphTexture===null&&(this.morphTexture=new Zg(new Float32Array(s*this.count),s,this.count,zl,qn));const r=this.morphTexture.source.data.data;let a=0;for(let c=0;c<n.length;c++)a+=n[c];const o=this.geometry.morphTargetsRelative?1:1-a,l=s*t;r[l]=o,r.set(n,l+1)}updateMorphTargets(){}dispose(){return this.dispatchEvent({type:"dispose"}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null),this}}class ff extends fs{static get type(){return"LineBasicMaterial"}constructor(t){super(),this.isLineBasicMaterial=!0,this.color=new Tt(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.linewidth=t.linewidth,this.linecap=t.linecap,this.linejoin=t.linejoin,this.fog=t.fog,this}}const ka=new F,Ha=new F,sh=new ue,wr=new $h,xa=new lr,Ao=new F,rh=new F;class $g extends Oe{constructor(t=new Ge,e=new ff){super(),this.isLine=!0,this.type="Line",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}computeLineDistances(){const t=this.geometry;if(t.index===null){const e=t.attributes.position,n=[0];for(let s=1,r=e.count;s<r;s++)ka.fromBufferAttribute(e,s-1),Ha.fromBufferAttribute(e,s),n[s]=n[s-1],n[s]+=ka.distanceTo(Ha);t.setAttribute("lineDistance",new Ce(n,1))}else console.warn("THREE.Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(t,e){const n=this.geometry,s=this.matrixWorld,r=t.params.Line.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),xa.copy(n.boundingSphere),xa.applyMatrix4(s),xa.radius+=r,t.ray.intersectsSphere(xa)===!1)return;sh.copy(s).invert(),wr.copy(t.ray).applyMatrix4(sh);const o=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=this.isLineSegments?2:1,f=n.index,u=n.attributes.position;if(f!==null){const p=Math.max(0,a.start),g=Math.min(f.count,a.start+a.count);for(let _=p,m=g-1;_<m;_+=c){const d=f.getX(_),E=f.getX(_+1),y=va(this,t,wr,l,d,E);y&&e.push(y)}if(this.isLineLoop){const _=f.getX(g-1),m=f.getX(p),d=va(this,t,wr,l,_,m);d&&e.push(d)}}else{const p=Math.max(0,a.start),g=Math.min(u.count,a.start+a.count);for(let _=p,m=g-1;_<m;_+=c){const d=va(this,t,wr,l,_,_+1);d&&e.push(d)}if(this.isLineLoop){const _=va(this,t,wr,l,g-1,p);_&&e.push(_)}}}updateMorphTargets(){const e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){const s=e[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){const o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}}function va(i,t,e,n,s,r){const a=i.geometry.attributes.position;if(ka.fromBufferAttribute(a,s),Ha.fromBufferAttribute(a,r),e.distanceSqToSegment(ka,Ha,Ao,rh)>n)return;Ao.applyMatrix4(i.matrixWorld);const l=t.ray.origin.distanceTo(Ao);if(!(l<t.near||l>t.far))return{distance:l,point:rh.clone().applyMatrix4(i.matrixWorld),index:s,face:null,faceIndex:null,barycoord:null,object:i}}const ah=new F,oh=new F;class jg extends $g{constructor(t,e){super(t,e),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){const t=this.geometry;if(t.index===null){const e=t.attributes.position,n=[];for(let s=0,r=e.count;s<r;s+=2)ah.fromBufferAttribute(e,s),oh.fromBufferAttribute(e,s+1),n[s]=s===0?0:n[s-1],n[s+1]=n[s]+ah.distanceTo(oh);t.setAttribute("lineDistance",new Ce(n,1))}else console.warn("THREE.LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}}class uf extends tn{constructor(t,e,n,s,r,a,o,l,c){super(t,e,n,s,r,a,o,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}}class Kl extends Ge{constructor(t=1,e=32,n=0,s=Math.PI*2){super(),this.type="CircleGeometry",this.parameters={radius:t,segments:e,thetaStart:n,thetaLength:s},e=Math.max(3,e);const r=[],a=[],o=[],l=[],c=new F,f=new Yt;a.push(0,0,0),o.push(0,0,1),l.push(.5,.5);for(let h=0,u=3;h<=e;h++,u+=3){const p=n+h/e*s;c.x=t*Math.cos(p),c.y=t*Math.sin(p),a.push(c.x,c.y,c.z),o.push(0,0,1),f.x=(a[u]/t+1)/2,f.y=(a[u+1]/t+1)/2,l.push(f.x,f.y)}for(let h=1;h<=e;h++)r.push(h,h+1,0);this.setIndex(r),this.setAttribute("position",new Ce(a,3)),this.setAttribute("normal",new Ce(o,3)),this.setAttribute("uv",new Ce(l,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Kl(t.radius,t.segments,t.thetaStart,t.thetaLength)}}class qa extends Ge{constructor(t=.5,e=1,n=32,s=1,r=0,a=Math.PI*2){super(),this.type="RingGeometry",this.parameters={innerRadius:t,outerRadius:e,thetaSegments:n,phiSegments:s,thetaStart:r,thetaLength:a},n=Math.max(3,n),s=Math.max(1,s);const o=[],l=[],c=[],f=[];let h=t;const u=(e-t)/s,p=new F,g=new Yt;for(let _=0;_<=s;_++){for(let m=0;m<=n;m++){const d=r+m/n*a;p.x=h*Math.cos(d),p.y=h*Math.sin(d),l.push(p.x,p.y,p.z),c.push(0,0,1),g.x=(p.x/e+1)/2,g.y=(p.y/e+1)/2,f.push(g.x,g.y)}h+=u}for(let _=0;_<s;_++){const m=_*(n+1);for(let d=0;d<n;d++){const E=d+m,y=E,S=E+n+1,O=E+n+2,T=E+1;o.push(y,S,T),o.push(S,O,T)}}this.setIndex(o),this.setAttribute("position",new Ce(l,3)),this.setAttribute("normal",new Ce(c,3)),this.setAttribute("uv",new Ce(f,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new qa(t.innerRadius,t.outerRadius,t.thetaSegments,t.phiSegments,t.thetaStart,t.thetaLength)}}class Li extends fs{static get type(){return"MeshLambertMaterial"}constructor(t){super(),this.isMeshLambertMaterial=!0,this.color=new Tt(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Tt(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Xh,this.normalScale=new Yt(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new In,this.combine=Nl,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.flatShading=t.flatShading,this.fog=t.fog,this}}class $l extends Oe{constructor(t,e=1){super(),this.isLight=!0,this.type="Light",this.color=new Tt(t),this.intensity=e}dispose(){}copy(t,e){return super.copy(t,e),this.color.copy(t.color),this.intensity=t.intensity,this}toJSON(t){const e=super.toJSON(t);return e.object.color=this.color.getHex(),e.object.intensity=this.intensity,this.groundColor!==void 0&&(e.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(e.object.distance=this.distance),this.angle!==void 0&&(e.object.angle=this.angle),this.decay!==void 0&&(e.object.decay=this.decay),this.penumbra!==void 0&&(e.object.penumbra=this.penumbra),this.shadow!==void 0&&(e.object.shadow=this.shadow.toJSON()),this.target!==void 0&&(e.object.target=this.target.uuid),e}}class Jg extends $l{constructor(t,e,n){super(t,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(Oe.DEFAULT_UP),this.updateMatrix(),this.groundColor=new Tt(e)}copy(t,e){return super.copy(t,e),this.groundColor.copy(t.groundColor),this}}const Ro=new ue,lh=new F,ch=new F;class Qg{constructor(t){this.camera=t,this.intensity=1,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new Yt(512,512),this.map=null,this.mapPass=null,this.matrix=new ue,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Yl,this._frameExtents=new Yt(1,1),this._viewportCount=1,this._viewports=[new Re(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(t){const e=this.camera,n=this.matrix;lh.setFromMatrixPosition(t.matrixWorld),e.position.copy(lh),ch.setFromMatrixPosition(t.target.matrixWorld),e.lookAt(ch),e.updateMatrixWorld(),Ro.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Ro),n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(Ro)}getViewport(t){return this._viewports[t]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(t){return this.camera=t.camera.clone(),this.intensity=t.intensity,this.bias=t.bias,this.radius=t.radius,this.mapSize.copy(t.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){const t={};return this.intensity!==1&&(t.intensity=this.intensity),this.bias!==0&&(t.bias=this.bias),this.normalBias!==0&&(t.normalBias=this.normalBias),this.radius!==1&&(t.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(t.mapSize=this.mapSize.toArray()),t.camera=this.camera.toJSON(!1).object,delete t.camera.matrix,t}}class t1 extends Qg{constructor(){super(new Xa(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}}class e1 extends $l{constructor(t,e){super(t,e),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(Oe.DEFAULT_UP),this.updateMatrix(),this.target=new Oe,this.shadow=new t1}dispose(){this.shadow.dispose()}copy(t){return super.copy(t),this.target=t.target.clone(),this.shadow=t.shadow.clone(),this}}class n1 extends $l{constructor(t,e){super(t,e),this.isAmbientLight=!0,this.type="AmbientLight"}}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:Ul}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=Ul);function i1(i,t=!1){const e=i[0].index!==null,n=new Set(Object.keys(i[0].attributes)),s=new Set(Object.keys(i[0].morphAttributes)),r={},a={},o=i[0].morphTargetsRelative,l=new Ge;let c=0;for(let f=0;f<i.length;++f){const h=i[f];let u=0;if(e!==(h.index!==null))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+f+". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them."),null;for(const p in h.attributes){if(!n.has(p))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+f+'. All geometries must have compatible attributes; make sure "'+p+'" attribute exists among all geometries, or in none of them.'),null;r[p]===void 0&&(r[p]=[]),r[p].push(h.attributes[p]),u++}if(u!==n.size)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+f+". Make sure all geometries have the same number of attributes."),null;if(o!==h.morphTargetsRelative)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+f+". .morphTargetsRelative must be consistent throughout all geometries."),null;for(const p in h.morphAttributes){if(!s.has(p))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+f+".  .morphAttributes must be consistent throughout all geometries."),null;a[p]===void 0&&(a[p]=[]),a[p].push(h.morphAttributes[p])}if(t){let p;if(e)p=h.index.count;else if(h.attributes.position!==void 0)p=h.attributes.position.count;else return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+f+". The geometry must have either an index or a position attribute"),null;l.addGroup(c,p,f),c+=p}}if(e){let f=0;const h=[];for(let u=0;u<i.length;++u){const p=i[u].index;for(let g=0;g<p.count;++g)h.push(p.getX(g)+f);f+=i[u].attributes.position.count}l.setIndex(h)}for(const f in r){const h=hh(r[f]);if(!h)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+f+" attribute."),null;l.setAttribute(f,h)}for(const f in a){const h=a[f][0].length;if(h===0)break;l.morphAttributes=l.morphAttributes||{},l.morphAttributes[f]=[];for(let u=0;u<h;++u){const p=[];for(let _=0;_<a[f].length;++_)p.push(a[f][_][u]);const g=hh(p);if(!g)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+f+" morphAttribute."),null;l.morphAttributes[f].push(g)}}return l}function hh(i){let t,e,n,s=-1,r=0;for(let c=0;c<i.length;++c){const f=i[c];if(t===void 0&&(t=f.array.constructor),t!==f.array.constructor)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes."),null;if(e===void 0&&(e=f.itemSize),e!==f.itemSize)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes."),null;if(n===void 0&&(n=f.normalized),n!==f.normalized)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes."),null;if(s===-1&&(s=f.gpuType),s!==f.gpuType)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes."),null;r+=f.count*e}const a=new t(r),o=new mn(a,e,n);let l=0;for(let c=0;c<i.length;++c){const f=i[c];if(f.isInterleavedBufferAttribute){const h=l/e;for(let u=0,p=f.count;u<p;u++)for(let g=0;g<e;g++){const _=f.getComponent(u,g);o.setComponent(u+h,g,_)}}else a.set(f.array,l);l+=f.count*e}return s!==void 0&&(o.gpuType=s),o}const on={thigh:.37,shin:.37,legs:.74,hipX:.13,torsoTop:.5,shoulderX:.35,shoulderY:.44,headPivotY:.5,seatDrop:.35};function s1(i){let t=i|0;return()=>{t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function Ws(i,t){const e=Math.min(255,Math.round((i>>16&255)*t)),n=Math.min(255,Math.round((i>>8&255)*t)),s=Math.min(255,Math.round((i&255)*t));return e<<16|n<<8|s}function r1(i,t,e){const n=Math.round((i>>16&255)*(1-e)+(t>>16&255)*e),s=Math.round((i>>8&255)*(1-e)+(t>>8&255)*e),r=Math.round((i&255)*(1-e)+(t&255)*e);return n<<16|s<<8|r}function Tl(i,t=8947848){if(!i)return t;const e=/^#?([0-9a-f]{6})$/i.exec(i.trim());return e?parseInt(e[1],16):t}const Wr=Dh(i=>({...Dl[i].accent})),a1=[16175792,15251596,13604192,11102523,8014378,5189404,16506052],o1=[2759958,4927003,9067051,14461509,11878442,1381660,9080730,8015832,3120089,15231654],l1=[3095126,3816002,5981750,4873530,5653355,8028044,2371642],c1=[15921906,1908004,9128480,15065288,12729147,3825584];function h1(i,t){const e=s1(i*7919+17),n=o=>o[Math.floor(e()*o.length)%o.length],s=["flat","bun","spiky","beanie","none","flat","spiky"],r=Wr[t],a=n([2830141,15921126,14725690,Ws(r.dark,.9)]);return{skin:n(a1),hair:n(o1),hairStyle:n(s),pants:n(l1),shoe:n(c1),glasses:e()<.35,longSleeve:e()<.35,beanie:a,beanieCuff:r1(a,16777215,.35),phase:e()*20}}function f1(i){switch((i||"").toLowerCase()){case"haiku":case"mini":return 1;case"sonnet":return 2;case"standard":return 3;case"opus":return 4;case"fable":case"max":return 5;default:return 3}}const u1=[0,.1,.29,.43,.32,.52],Ma=new Tt;function d1(i,t,e){const n=i.getAttribute("position"),s=i.getAttribute("normal"),r=n.count,a=new Float32Array(r*3);Ma.setHex(t);for(let o=0;o<r;o++){let l=1;if(e){const c=s.getY(o),f=s.getX(o);l=c>.5?1:c<-.5?.5:Math.abs(f)>.5?.7:.84}a[o*3]=Ma.r*l,a[o*3+1]=Ma.g*l,a[o*3+2]=Ma.b*l}i.setAttribute("color",new mn(a,3))}function q(i,t,e,n,s,r,a,o=0,l=0,c=0,f=!1){const h=new Ie(i,t,e);return h.deleteAttribute("uv"),o&&h.rotateX(o),l&&h.rotateY(l),c&&h.rotateZ(c),h.translate(n,s,r),d1(h,a,f),h}function wt(i,t,e,n,s,r,a,o=0,l=0,c=0){return q(i,t,e,n,s,r,a,o,l,c,!0)}function Kt(i){const t=i1(i,!1);for(const e of i)e.dispose();if(!t)throw new Error("merge failed");return t}const Rn=new Li({vertexColors:!0}),xn=new Xt({vertexColors:!0});new Xt({vertexColors:!0,side:Ln});const p1=new Xt({color:16777215});function m1(i){return i==="worker"?.07:0}function g1(i,t,e,n){const s=Wr[t],r=i.skin,a=1776420,o=n??10133677,l=Kt([q(.5,.13,.28,0,.035,0,i.pants),q(.53,.05,.31,0,.085,0,2763312),q(.08,.05,.02,0,.085,-.16,14205546)]),c=[q(.52,.4,.3,0,.3,0,s.main),q(.52,.07,.3,0,.465,0,s.light),q(.18,.06,.18,0,.52,0,r),q(.2,.2,.02,m1(e),.3,-.155,a)];e==="worker"?(c.push(q(.034,.3,.02,-.15,.34,-.158,o)),c.push(q(.1,.13,.02,-.15,.16,-.158,o)),c.push(q(.07,.03,.022,-.15,.19,-.16,16777215))):c.push(q(.52,.035,.31,0,.42,0,o)),e==="worker"&&c.push(q(.52,.03,.31,0,.42,0,o));const f=Kt(c),h=[q(.48,.48,.48,0,.26,0,r),q(.04,.1,.08,.26,.26,0,r),q(.04,.1,.08,-.26,.26,0,r),q(.06,.07,.04,0,.21,-.25,Ws(r,.9))],u=i.hair,p=()=>h.push(q(.5,.3,.06,0,.37,.23,u)),g=()=>h.push(q(.5,.07,.04,0,.465,-.245,u));switch(i.hairStyle){case"flat":h.push(q(.5,.1,.5,0,.54,0,u)),p(),g(),h.push(q(.03,.12,.2,.245,.42,-.1,u),q(.03,.12,.2,-.245,.42,-.1,u));break;case"bun":h.push(q(.5,.09,.5,0,.535,0,u)),p(),g(),h.push(q(.2,.2,.2,0,.64,.13,u),q(.22,.04,.22,0,.55,.13,s.main));break;case"spiky":{h.push(q(.5,.06,.5,0,.52,0,u)),p(),g();const z=[[0,0,.2,0],[-.15,-.14,.15,.25],[.15,-.14,.15,-.25],[-.15,.14,.15,.25],[.15,.14,.15,-.25],[0,-.16,.12,0],[0,.16,.12,0]];for(const C of z)h.push(q(.12,C[2]+.04,.12,C[0],.55+C[2]/2,C[1],u,C[1]*.8,0,C[3]+C[0]*.5));break}case"beanie":h.push(q(.52,.14,.52,0,.51,0,i.beanie)),h.push(q(.545,.07,.545,0,.45,0,i.beanieCuff)),h.push(q(.12,.1,.12,0,.62,0,i.beanieCuff)),h.push(q(.5,.1,.04,0,.38,.24,u));break}if(i.glasses){for(const C of[-1,1]){const W=C*.115;h.push(q(.17,.025,.02,W,.36,-.248,1381660),q(.17,.025,.02,W,.245,-.248,1381660),q(.025,.12,.02,W-.0725,.3,-.248,1381660),q(.025,.12,.02,W+.0725,.3,-.248,1381660)),h.push(q(.02,.02,.4,C*.245,.33,-.04,1381660))}h.push(q(.06,.025,.02,0,.33,-.248,1381660))}n!==null&&h.push(q(.5,.05,.5,0,.405,0,o)),e==="orchestrator"?(h.push(q(.55,.045,.08,0,.525,0,2764088)),h.push(q(.04,.24,.07,.268,.4,0,2764088),q(.04,.24,.07,-.268,.4,0,2764088)),h.push(q(.08,.17,.17,.29,.26,0,s.main),q(.08,.17,.17,-.29,.26,0,s.main)),h.push(q(.09,.09,.09,.3,.26,0,s.light),q(.09,.09,.09,-.3,.26,0,s.light)),h.push(q(.03,.03,.2,-.29,.17,-.14,2764088)),h.push(q(.2,.03,.03,-.2,.15,-.255,2764088)),h.push(q(.07,.07,.07,-.1,.15,-.255,1118486))):e==="integrator"&&(h.push(q(.53,.06,.53,0,.465,0,Ws(4054148,.75))),h.push(q(.5,.03,.26,0,.455,-.37,4054148)),h.push(q(.5,.012,.03,0,.455,-.505,12124116)));const _=Kt(h),m=s.main,d=()=>Kt([q(.17,.27,.17,0,-.135,0,m),q(.18,.04,.18,0,-.25,0,s.light),q(.18,.04,.18,0,-.07,0,o)]),E=z=>{const C=[q(.145,.2,.145,0,-.1,0,i.longSleeve?s.dark:r),q(.155,.035,.155,0,-.185,0,2763312),q(.15,.1,.15,0,-.25,0,r)];return z&&C.push(q(.05,.05,.02,-0,-.185,-.08,14676991)),Kt(C)},y=d(),S=d(),O=E(!1),T=E(!0),R=Kt([q(.2,.37,.22,0,-.185,0,i.pants)]),I=Kt([q(.18,.27,.2,0,-.135,0,i.pants),q(.2,.08,.3,0,-.31,-.05,i.shoe),q(.21,.03,.31,0,-.355,-.05,Ws(i.shoe,.45))]),b=Kt([q(.36,.34,.12,0,.29,.21,s.dark),q(.38,.05,.14,0,.45,.21,Ws(s.dark,.75)),q(.12,.3,.05,0,.29,.295,1315867),q(.04,.02,.07,.07,.4,.3,16763972),q(.04,.02,.07,.07,.4-0,.3,16763972)]);let M;t==="claude"?M=Kt([wt(.17,.04,.02,0,0,0,s.glow),wt(.17,.04,.02,0,0,0,s.glow,0,0,Math.PI/2),wt(.15,.04,.02,0,0,0,s.glow,0,0,Math.PI/4),wt(.15,.04,.02,0,0,0,s.glow,0,0,-Math.PI/4)]):M=Kt([wt(.07,.035,.02,-.055,.025,0,s.glow,0,0,Math.PI/4),wt(.07,.035,.02,-.055,-.025,0,s.glow,0,0,-Math.PI/4),wt(.07,.035,.02,.055,.025,0,s.glow,0,0,-Math.PI/4),wt(.07,.035,.02,.055,-.025,0,s.glow,0,0,Math.PI/4),wt(.032,.12,.02,0,0,0,s.glow,0,0,-.35)]);const A=Kt([q(.1,.11,.02,-.11,0,0,16777215),q(.1,.11,.02,.11,0,0,16777215),q(.055,.075,.024,-.105,-.005,-.002,1381663),q(.055,.075,.024,.105,-.005,-.002,1381663)]),V=Kt([q(.12,.05,.02,0,0,0,5974570)]);return{pelvis:l,torso:f,head:_,upperR:y,upperL:S,foreR:O,foreL:T,thigh:R,shin:I,pack:b,badge:M,eyes:A,mouth:V}}function _1(i){return i.hairStyle==="spiky"?.6:i.hairStyle==="beanie"?.67:.57}const fh=new Map;function x1(i,t){const e=t+i,n=fh.get(e);if(n)return n;const s=Wr[t],r=16765514,a=3816778;let o=null,l=null,c=null;if(i===1)l=Kt([wt(.09,.09,.09,0,.045,0,s.glow)]);else if(i===2)o=Kt([q(.035,.2,.035,0,.1,0,a),q(.07,.03,.07,0,.015,0,a)]),l=Kt([wt(.09,.09,.09,0,.245,0,s.glow)]);else if(i===3)o=Kt([q(.035,.26,.035,0,.13,0,a),q(.08,.03,.08,0,.015,0,a)]),l=Kt([wt(.17,.17,.17,0,.345,0,s.glow,.6,0,.6)]);else{const h=[q(.4,.07,.06,0,.035,.17,r),q(.4,.07,.06,0,.035,-.17,r),q(.06,.07,.4,.17,.035,0,r),q(.06,.07,.4,-.17,.035,0,r)],u=[];for(const p of[-1,1])for(const g of[-1,1])h.push(q(.08,.16,.08,p*.17,.15,g*.17,r)),u.push(wt(.075,.075,.075,p*.17,.25,g*.17,s.glow));h.push(q(.1,.26,.1,0,.13,0,r)),u.push(wt(.09,.09,.09,0,.3,0,s.glow)),o=Kt(h),l=Kt(u),i===5&&(c=Kt([wt(.54,.05,.06,0,.5,.24,16773552),wt(.54,.05,.06,0,.5,-.24,16773552),wt(.06,.05,.42,.24,.5,0,16773552),wt(.06,.05,.42,-.24,.5,0,16773552)]))}const f={body:o,glow:l,halo:c};return fh.set(e,f),f}const Tr=new Map,df=6,Sa=[16752451,6210303,11832575,16767050,16740241,7071109];function uh(i,t,e){const n=Math.max(1,Math.min(df,t|0)),s=i+n+(i==="skills"?e.join(""):""),r=Tr.get(s);if(r)return r;const a=[],o=i==="skills"?.06:.03,l=n*o;for(let f=0;f<n;f++){const h=f*o+o/2-l/2,u=Math.sin(f*12.9)*.012,p=Math.cos(f*7.7)*.01,g=Math.sin(f*5.3)*.05;if(i==="skills"){const _=Tl(e.length?e[f%e.length]:void 0,Sa[f%Sa.length]),m=.3-f%3*.015;a.push(q(m,o*.92,.23,u,h,p,_,0,g,0)),a.push(q(m-.03,o*.55,.01,u,h,p+.115,16052192,0,g,0)),a.push(q(.03,o*.95,.235,u-m/2+.015,h,p,Ws(_,.72),0,g,0)),a.push(q(.07,o*.3,.012,u,h,p-.117,16777215,0,g,0))}else a.push(q(.3,o*.94,.23,u,h,p,16118504,0,g,0)),i==="tickets"?(a.push(q(.075,o,.06,u+.115,h,p-.085,Sa[f%Sa.length],0,g,0)),a.push(q(.18,o*.96,.012,u-.04,h,p-.02,13617848,0,g,0))):i==="pr"?a.push(q(.3,o*.98,.045,u,h,p-.07,3462041,0,g,0)):a.push(q(.3,o*.98,.045,u,h,p-.07,15680580,0,g,0))}if(i==="rejected"){const f=l/2+.002;a.push(q(.24,.012,.04,0,f,.03,15680580,0,.75,0)),a.push(q(.24,.012,.04,0,f,.03,15680580,0,-.75,0))}const c=Kt(a);if(Tr.size>80){for(const f of Tr.values())f.dispose();Tr.clear()}return Tr.set(s,c),c}const Xi={_clip:null,_marker:null,_pen:null,_stamp:null,_sheet:null,_plane:null,clipboard(){return this._clip??=Kt([q(.26,.34,.025,0,0,0,10119740),q(.21,.28,.012,0,-.01,-.012,16184298),q(.09,.04,.03,0,.17,-.005,9212574),q(.15,.015,.014,0,.04,-.02,10133677),q(.15,.015,.014,0,0,-.02,10133677),q(.1,.015,.014,-.025,-.04,-.02,10133677)])},marker(){return this._marker??=Kt([q(.045,.2,.045,0,-.1,0,3042303),q(.05,.05,.05,0,-.01,0,15921906),q(.03,.04,.03,0,-.22,0,1785766)])},pen(){return this._pen??=Kt([q(.035,.2,.035,0,-.1,0,14694970),q(.025,.05,.025,0,-.225,0,2763312)])},stamp(){return this._stamp??=Kt([q(.07,.1,.07,0,-.04,0,6965802),q(.09,.03,.09,0,-.1,0,6965802),q(.24,.05,.17,0,-.135,0,12729147),q(.22,.025,.15,0,-.17,0,8003359)])},plane(){return this._plane??=Kt([q(.035,.05,.22,0,-.01,0,14474448),q(.2,.012,.12,.1,.012,.03,16777215,0,0,.18),q(.2,.012,.12,-.1,.012,.03,16777215,0,0,-.18),q(.03,.03,.05,0,0,-.12,16740241)])},sheet(){return this._sheet??=Kt([q(.26,.02,.2,0,0,0,16118504),q(.16,.022,.012,-.03,0,-.04,11051923),q(.16,.022,.012,-.03,0,-.01,11051923),q(.1,.022,.012,-.06,0,.02,11051923),q(.05,.024,.05,.09,0,.07,3462041)])}},dh=new Map;function Yi(i,t){let e=dh.get(i);return e||(e=t(),dh.set(i,e)),e}const ri={bang:()=>Yi("bang",()=>Kt([wt(.17,.12,.17,0,.2,0,16731486),wt(.12,.16,.12,0,.06,0,16731486),wt(.12,.12,.12,0,-.17,0,16731486)])),hourglass:()=>Yi("hg",()=>{const e=[wt(.05,.04,.05,0,0,0,16761395)];for(const n of[1,-1])e.push(wt(.1,.06,.1,0,n*.05,0,16761395),wt(.17,.06,.17,0,n*.11,0,16761395),wt(.24,.06,.24,0,n*.17,0,16761395)),e.push(wt(.3,.04,.3,0,n*.22,0,12155420));return Kt(e)}),z:i=>Yi("z"+i,()=>{const n=Math.hypot(i,i);return Kt([wt(i,.045,.07,0,i/2,0,13625087),wt(i,.045,.07,0,-i/2,0,13625087),wt(.045,n,.07,0,0,0,13625087,0,0,-Math.PI/4-.1)])}),pencil:()=>Yi("pencil",()=>Kt([wt(.07,.26,.07,0,0,0,16765503),wt(.07,.05,.07,0,.155,0,16748465),wt(.07,.06,.07,0,-.16,0,15781795),wt(.03,.03,.03,0,-.205,0,2763312),wt(.05,.05,.05,.2,.1,0,16774064),wt(.04,.04,.04,-.2,-.05,.05,16774064),wt(.04,.04,.04,.05,.25,-.2,16774064)])),think:()=>Yi("think",()=>Kt([wt(.08,.08,.08,.14,-.05,0,13625599),wt(.08,.08,.08,-.07,0,.12,13625599),wt(.08,.08,.08,-.07,.07,-.12,13625599)])),question:()=>Yi("q",()=>{const i=[".XXX.","X...X","....X","..XX.","..X..",".....","..X.."],n=[];for(let s=0;s<i.length;s++)for(let r=0;r<5;r++){if(i[s][r]!=="X")continue;const a=(r-2)*.065,o=(3-s)*.065;n.push(wt(.065,.065,.09,a,o,0,16767050))}return Kt(n)}),star:()=>Yi("star",()=>Kt([wt(.14,.14,.14,0,0,0,16769126),wt(.06,.34,.06,0,0,0,16769126),wt(.34,.06,.06,0,0,0,16769126),wt(.06,.06,.34,0,0,0,16769126),wt(.05,.24,.05,0,0,0,16774064,0,0,Math.PI/4),wt(.05,.24,.05,0,0,0,16774064,0,0,-Math.PI/4),wt(.05,.24,.05,0,0,0,16774064,Math.PI/4,0,0),wt(.05,.24,.05,0,0,0,16774064,-Math.PI/4,0,0)]))},qi={_drone:null,_ring:null,_sel:null,_flashRing:null,_flashShell:null,_particle:null,_cart:null,_gaugeFill:null,drone(i){const t=Wr[i],e="_drone"+i,n=this;return n[e]??=Kt([wt(.17,.15,.17,0,0,0,t.glow),wt(.2,.025,.04,0,.09,0,16777215),wt(.04,.025,.2,0,.09,0,16777215),wt(.12,.04,.02,0,.01,-.09,1315867)])},selRing(){if(!this._sel){const i=new qa(.66,.8,8,1);i.rotateX(-Math.PI/2),i.rotateY(Math.PI/8),this._sel=i}return this._sel},flashRing(){return this._flashRing??=Kt([wt(1,.05,.07,0,0,.5,16777215),wt(1,.05,.07,0,0,-.5,16777215),wt(.07,.05,1,.5,0,0,16777215),wt(.07,.05,1,-.5,0,0,16777215)])},flashShell(){return this._flashShell??=Kt([q(.6,.5,.38,0,.3,.02,16777215),q(.56,.56,.56,0,.78,0,16777215),q(.42,.38,.2,0,.29,.22,16777215)])},particle(){return this._particle??=new Ie(.07,.07,.07)},cartridge(){return this._cart??=Kt([q(.085,.14,.06,0,.07,0,2763316),wt(.06,.085,.066,0,.075,0,16777215),q(.05,.02,.05,0,0,0,12105928)])},gaugeFill(){if(!this._gaugeFill){const i=new Ie(.14,1,.07);i.translate(0,.5,0),this._gaugeFill=i}return this._gaugeFill}},Ni=0,Za=1,kr=2,jl=3,hr=4,Ae=5,Fi=6,fr=7,Ye=8,gn=9,sr=10,dn=11,rs=12,_i=13,pn=14,as=15,Zn=16,Kn=17,Hr=18,Ve=19,pi=20,Gr=21,qe=22,pf=23,Gn=24,us=25,Al=26,es=27,ns=28,is=29,Mn=30,mf=31,gf=32,_f=33,Na=34,ks=35,js=Math.PI,Xs=Math.PI/2;function Xe(i){return i=i<0?0:i>1?1:i,i*i*(3-2*i)}function rr(i,t,e,n,s){return i<=t||i>=s?0:i<e?Xe((i-t)/(e-t)):i<n?1:1-Xe((i-n)/(s-n))}function Rl(i,t){return Math.sin(i*.9+t)*Math.sin(i*.37+t*1.7)}function He(i){return i>0?i:0}const Is=.27,Zi=.3,ph=.35,v1=.44;function Ue(i,t,e,n,s){let r=e-(t?-ph:ph);t&&(r=-r);let a=n-v1,o=s,l=Math.sqrt(r*r+a*a+o*o);const c=Is+Zi-.004,f=Math.abs(Is-Zi)+.05;if(l>c){const S=c/l;r*=S,a*=S,o*=S,l=c}else if(l<f)if(l<1e-4)o=-f,l=f;else{const S=f/l;r*=S,a*=S,o*=S,l=f}let h=(l*l-Is*Is-Zi*Zi)/(2*Is*Zi);h=h<-1?-1:h>1?1:h;const u=Math.acos(h),p=Is+Zi*h,g=Zi*Math.sin(u);let _=r/p;_=_<-.97?-.97:_>.97?.97:_;const m=Math.asin(_),d=p*Math.cos(m);let E=Math.atan2(o,a)-Math.atan2(-g,-d);for(;E<-1.4;)E+=2*js;for(;E>2*js-1.4;)E-=2*js;const y=t?pn:dn;i[y]=E,i[y+1]=m,i[y+2]=u}function En(i,t,e,n,s,r){const a=Math.cos(r),o=Math.sin(r);Ue(i,t,e,n*a-s*o,n*o+s*a)}function M1(i,t,e,n){const s=pn;for(let r=0;r<3;r++)i[s+r]+=(t[s+r]-i[s+r])*n}const Cn=new Float32Array(ks);function Sn(i){i.fill(0),i[Gn]=1,i[rs]=.07,i[as]=.07,i[_i]=.14,i[Zn]=.14,i[Hr]=.03,i[Gr]=.03}function xi(i){i[pf]=1,i[Kn]=Xs,i[pi]=Xs,i[Ve]=Xs,i[qe]=Xs,i[Hr]=.06,i[Gr]=.06}function xf(i,t,e){Ue(i,!1,.215,t,e-.06),Ue(i,!0,-.215,t,e-.06),i[es]=t,i[ns]=e,i[is]=1}const Ys=.2,qs=-.37;function S1(i,t){xf(i,Ys+t,qs)}function vf(i,t,e){const n=t*2*js,s=Math.sin(n),r=Math.cos(n);i[Kn]=.55*s,i[pi]=-.55*s;let a=He(r);a=a*a*(3-2*a);let o=He(-r);o=o*o*(3-2*o),i[Ve]=.12+.95*a,i[qe]=.12+.95*o,i[dn]=-e*s,i[pn]=e*s,i[_i]=.25+.7*He(-s)*(e/.65),i[Zn]=.25+.7*He(s)*(e/.65),i[jl]=.1*s,i[fr]=-.17*s,i[gn]=.07*s,i[hr]=.025*s,i[Fi]=-.03*s,i[Ae]=.07}const Mf=(i,t,e,n,s)=>{Sn(i);const r=Math.sin(t*2.1+s.phase);if(i[Mn]=r,i[gn]=.7*Rl(t,s.phase),i[Ye]=.05*Rl(t*.8,s.phase+2)-.02,n)xi(i),i[Ae]=.03+.01*r,En(i,!1,.13,.12,-.24,.03),En(i,!0,-.13,.12,-.24,.03);else{const a=Math.sin(t*.45+s.phase);i[Ni]=.03*a,i[hr]=.03*a,i[Fi]=-.025*a,i[Ve]=.04+.08*He(a),i[qe]=.04+.08*He(-a),i[dn]=.03*r,i[pn]=-.03*r,i[Ae]=.012*r}},y1=(i,t)=>{Sn(i),vf(i,t,.62),i[Mn]=0},b1=(i,t)=>{Sn(i),vf(i,t,0);const e=t*2*js;i[fr]=-.05*Math.sin(e),i[Ae]=0,i[Fi]=0,xf(i,Ys+.016*Math.sin(2*e+1),qs+.008*Math.sin(e))},E1=(i,t,e,n,s)=>{Sn(i),i[Mn]=Math.sin(t*2.1);const r=e/1.9%1;let a;r<.4?a=Xe(r/.4):r<.55?a=1:r<.95?a=1-Xe((r-.55)/.4):a=0;let o;if(s.carry?o=Xe((r-.47)/.08):s.hasLast?o=1-Xe((r-.47)/.08):o=0,i[gn]=.15*Math.sin(t*1.3),s.reachUp){i[Ae]=-.12*a,i[Ye]=-.25*a;const l=Ys+(.62-Ys)*a,c=qs+(-.42-qs)*a;Ue(i,!1,.215,l,c-.06),Ue(i,!0,-.215,l,c-.06),i[es]=l,i[ns]=c,i[is]=o,i[kr]=-.03*a,i[Ve]=.04,i[qe]=.04}else{i[Ae]=.55*a,i[Kn]=.45*a,i[pi]=.45*a,i[Ve]=.95*a,i[qe]=.95*a,i[kr]=.1*a,i[Ye]=-.3*a;const l=Ys+(.12-Ys)*a,c=qs+(-.5-qs)*a;Ue(i,!1,.215,l,c-.06),Ue(i,!0,-.215,l,c-.06),i[es]=l,i[ns]=c,i[is]=o}},w1=(i,t,e,n,s)=>{Sn(i),i[Mn]=Math.sin(t*2.4)*.6;const r=.2+.8*Xe((.55+.45*Math.sin(t*.8+s.phase)-.25)*3),a=.032*He(Math.sin(t*37+s.phase))*r,o=.032*He(Math.sin(t*43+1.7))*r,l=.1+.025*Math.sin(t*.9);i[Ae]=l,i[Ye]=.14+.05*Math.sin(t*2.3+s.phase)*r,i[gn]=.12*Math.sin(t*.7+s.phase),i[Gn]=.95,i[Ni]=.0035*Math.sin(t*53)*r,i[kr]=.003*Math.sin(t*61)*r,i[fr]=.03*Math.sin(t*5.1)*r,n?(xi(i),En(i,!1,.12,.33-a,-.4,l),En(i,!0,-.12,.33-o,-.4,l)):(En(i,!1,.13,.2-a,-.4,l),En(i,!0,-.13,.2-o,-.4,l),i[Ve]=.05,i[qe]=.05)},T1=(i,t,e,n,s)=>{Sn(i),i[Mn]=Math.sin(t*1.9),i[sr]=.22+.03*Math.sin(t*.5),i[Ye]=-.1+.05*Math.sin(t*.4+1),i[gn]=.18*Math.sin(t*.33+s.phase),i[Gn]=.85+.1*Math.sin(t*.7);const r=0;i[Ae]=r-.05,i[Fi]=.05,Ue(i,!1,.04,.5+.015*Math.sin(t*1.3),-.25);const a=He(Math.sin(t*2.4))*rr(t%4.2,.8,1,1.8,2.2);n?(xi(i),En(i,!0,-.18,.33-.035*a,-.36,-.05)):(Ue(i,!0,-.19,.2-.035*a,-.28),i[Ve]=.05+.06*Math.sin(t*.4),i[qe]=.05,i[Ni]=.02*Math.sin(t*.4))},A1=(i,t,e,n,s)=>{Sn(i);const r=(t+s.phase)%11,a=rr(r,2.2,3,4.6,5.4),o=rr(r,6.6,7.4,8.8,9.6);i[Mn]=Math.sin(t*1.6)*(1+.8*o);const l=Math.sin(t*8.5);n?(xi(i),i[Ae]=.24-.05*a-.2*o,i[Ye]=.2-.02*Math.sin(t*.6)-.12*a-.55*o,i[gn]=.25*Math.sin(t*.3+s.phase)*(1-a),i[Ve]=Xs-.2*He(l),i[Kn]=Xs+.05*He(l),En(i,!1,.14,.14,-.2,.2),En(i,!0,-.14,.14,-.2,.2)):(i[Ae]=.02-.12*o,i[Ye]=.08-.1*a-.5*o,i[gn]=.45*Rl(t*.8,s.phase)*(1-a),i[hr]=.03,i[Ni]=.03,i[Ve]=.08,i[Kn]=0,i[qe]=.1+.55*He(l),i[pi]=.1*He(l),Ue(i,!1,-.14,.27,-.2),Ue(i,!0,.16,.2,-.22)),a>.001&&(Cn.fill(0),Ue(Cn,!0,-.08,.58,-.3),M1(i,Cn,!0,a),i[gn]+=.25*a),o>.001&&(i[dn]+=(2.75-i[dn])*o,i[pn]+=(2.75-i[pn])*o,i[rs]+=(.55-i[rs])*o,i[as]+=(.55-i[as])*o,i[_i]+=(.25-i[_i])*o,i[Zn]+=(.25-i[Zn])*o,i[us]=o,i[Gn]=1-.85*o),i[Gn]*=1-.4*(n?1:0)},R1=(i,t,e,n,s)=>{Sn(i);const r=(t+s.phase*.1)%5.2,a=rr(r,2.4,2.8,4.5,4.9);i[Mn]=Math.sin(t*5)*.7,i[Gn]=.6,i[us]=.3+.3*a;const o=.22*Math.sin(t*13)*(1-a);n?(xi(i),i[Ae]=.38*(1-a)+.1*a,i[Ye]=.3*(1-a)):(i[Ae]=.2*(1-a),i[Ye]=.25*(1-a)-.1*a,i[Ve]=.1,i[qe]=.1),i[gn]=o+.1*a*Math.sin(t*11),i[Fi]=.04*Math.sin(t*7);const l=.012*Math.sin(t*29);if(Ue(i,!1,.26+l,.8,-.1),Ue(i,!0,-.26-l,.8,-.1),a>.001){const c=Math.sin(t*17)*.2;Cn.fill(0),Cn[dn]=2.5+c*.4,Cn[pn]=2.5-c*.4,Cn[rs]=.45,Cn[as]=.45,Cn[_i]=1.1+c,Cn[Zn]=1.1-c;for(let f=0;f<3;f++)i[dn+f]+=(Cn[dn+f]-i[dn+f])*a,i[pn+f]+=(Cn[pn+f]-i[pn+f])*a;i[Za]=.015*Math.sin(t*17)*a}},C1=(i,t,e,n,s)=>{Sn(i),i[Mn]=Math.sin(t*2);const r=.1;i[Ae]=r,i[Ye]=.18,i[Gn]=.9,n?xi(i):(i[Ve]=.06,i[qe]=.06);const a=n?.33:.22,o=.6-(n?.08:0),l=-.36;if(Ue(i,!0,-.12,o+.02*Math.sin(t*.8),l),i[gn]=.18*Math.sin(t*1.1+s.phase),s.integrator){const c=(t+s.phase*.2)%3.6;let f=.2;c<1.6?f=.2:c<2?f=.2+.25*Xe((c-1.6)/.4):c<2.1?f=.45*(1-(c-2)/.1):c<2.5?f=0:c<3&&(f=.2*Xe((c-2.5)/.5)),En(i,!1,.1,a+.17+f,-.44,r),c>2&&c<2.4&&(i[Za]=-.015*(1-Xe((c-2)/.4)),i[Ae]+=.05)}else Ue(i,!1,-.02+.06*Math.sin(t*5),o-.03+.025*Math.sin(t*8.3),l-.03)},P1=(i,t,e,n,s)=>{Sn(i),i[Mn]=Math.sin(t*2);const r=Math.sin(t*.6+s.phase),a=.2*r;i[Ni]=a,i[Hr]=-a/.74+.03,i[Gr]=-a/.74+.03,i[Ve]=.06+.1*He(r),i[qe]=.06+.1*He(-r),i[Ae]=-.03,i[fr]=.1*r,i[Ye]=-.12+.05*Math.sin(t*1.4),i[gn]=.1*Math.sin(t*.9),Ue(i,!1,.3+.1*Math.sin(t*1.6)+.05*Math.sin(t*5),.78+.08*Math.sin(t*1.1+1)+.025*Math.sin(t*7),-.46),Ue(i,!0,-.12,.24,-.3)},L1=(i,t,e,n,s)=>{Sn(i),i[Gn]=.75,i[us]=.8,i[Al]=1;const r=e/.75%1;let a=0,o=0;if(r<.2)a=Xe(r/.2);else if(r<.8){const f=(r-.2)/.6;o=Math.sin(f*js),a=0}else a=1-Xe((r-.8)/.2);i[Za]=.42*o;const l=.5*o;i[Kn]=.5*a+l*.7,i[pi]=.5*a+l*.4,i[Ve]=1*a+l,i[qe]=1*a+l*1.2,i[Ae]=.2*a-.08*o;const c=Math.sin(t*18);i[dn]=2.85-.15*a+.1*c,i[pn]=2.85-.15*a-.1*c,i[rs]=.45+.1*c,i[as]=.45-.1*c,i[_i]=.25,i[Zn]=.25,i[jl]=.7*Math.sin(e*3.2+s.phase*0),i[Ye]=-.25,i[sr]=.1*c,i[Mn]=Math.sin(t*9)},D1=(i,t,e,n,s)=>{Sn(i),i[Gn]=0;const r=Math.sin(t*1.3);if(i[Mn]=r*1.2,i[us]=.15+.1*Math.sin(t*1.3+1),n){xi(i);const a=.78;i[Ae]=a+.015*r,i[Ye]=.35,i[sr]=.55+.02*r,i[gn]=.35,En(i,!1,.17,.37,-.47,a),En(i,!0,-.17,.37,-.47,a)}else{const a=Math.sin(t*.7+s.phase);i[Ae]=.12+.05*r,i[Ye]=.55+.05*Math.sin(t*.5),i[sr]=.15*a,i[Ni]=.04*a,i[hr]=.05*a,i[Fi]=-.06*a,i[Ve]=.12+.05*He(a),i[qe]=.12+.05*He(-a),i[dn]=.05,i[pn]=.05}},I1=1.1,U1=.6,ya=[0,.3,.48,.6,.78,1],N1=[.03,.03,.3,.22,.1,.03],F1=[.22,.22,.86,.8,.25,.22],O1=[-.3,-.3,.2,-.6,-.5,-.3],B1=[.1,.1,-.12,.15,.3,.1],z1=[0,0,-.35,.3,.2,0],k1=[.22,.22,.6,.58,.3,.22],H1=[-.3,-.3,0,-.55,-.45,-.3],G1=[.05,.05,-.04,.1,.18,.05],V1=[0,0,-.3,.28,.15,0],W1=[-.03,-.03,-.26,-.28,-.2,-.03],X1=[.22,.22,.32,.3,.22,.22],Y1=[-.3,-.3,-.38,-.34,-.3,-.3];function Ti(i,t){let e=0;for(;e<4&&i>=ya[e+1];)e++;let n=(i-ya[e])/(ya[e+1]-ya[e]);return n=e===2?n*n:Xe(n),t[e]+(t[e+1]-t[e])*n}const q1=(i,t,e,n,s)=>{Sn(i),i[Mn]=Math.sin(t*2.2);const r=e/I1%1,a=Ti(r,N1),o=Ti(r,n?k1:F1),l=Ti(r,n?H1:O1),c=r<.3?.02*Math.sin(e*24):0;if(i[Ae]=Ti(r,n?G1:B1),i[fr]=Ti(r,n?V1:z1),i[Ye]=.25*(1-Xe((r-.3)/.15))*(r<.6?1:0)-.05,i[gn]=r<.3?0:-.25*Xe((r-.3)/.2)*(1-Xe((r-.7)/.2)),i[us]=.5*rr(r,.5,.58,.68,.8),Ue(i,!1,a+c,o,l),Ue(i,!0,Ti(r,W1)-c,Ti(r,X1),Ti(r,Y1)),n)xi(i);else{const f=rr(r,.42,.6,.7,.92);i[pi]=.45*f,i[qe]=.12+.1*f,i[Ve]=.15*f+.05,i[Kn]=-.1*f,i[kr]=0+0*f}i[Na]=r<.18?0:r<.3?Xe((r-.18)/.12):r<U1?1:0,i[mf]=a,i[gf]=o+.02,i[_f]=l-.07},Z1=(i,t,e,n,s)=>{Sn(i),i[Mn]=Math.sin(t*3);const r=Math.sin(t*7.5);if(i[dn]=2.95,i[rs]=.22+.4*r,i[_i]=.12+.2*Math.sin(t*7.5+1.2),i[Fi]=-.05*r-.05,i[Ae]=-.04,i[gn]=.75*Math.sin(t*1.3+s.phase*.1)*Math.sin(t*.5+1),i[Ye]=-.12+.05*Math.sin(t*2.1),i[sr]=.1*Math.sin(t*1.3),i[us]=.35+.25*He(Math.sin(t*5)),i[Gn]=1,n)xi(i),En(i,!0,-.18,.33,-.36,-.04);else{i[pn]=.15,i[as]=.6,i[Zn]=1.75,i[Ve]=.06,i[qe]=.06;const a=Math.sin(t*1.1);i[Ni]=.02*a,i[hr]=.02*a}},K1={idle:Mf,walk:y1,carry_walk:b1,pickup:E1,type:w1,think:T1,wait:A1,blocked:R1,review:C1,plan:P1,celebrate:L1,sleep:D1,throw:q1,raise_hand:Z1};function $1(i,t,e,n,s,r){(K1[i]??Mf)(e,n,s,t,r)}function j1(i){return i==="idle"||i==="type"||i==="think"||i==="wait"||i==="blocked"||i==="sleep"||i==="review"||i==="throw"||i==="raise_hand"}const mh={headHeightStanding:2.9},J1=["idle","walk","carry_walk","pickup","type","think","wait","blocked","review","plan","celebrate","sleep","throw","raise_hand"],Sf={};J1.forEach((i,t)=>{Sf[i]=t});const gh=new Map;function Q1(i){const t=String(i);let e=gh.get(t);return e||(e=new Xt({color:i,side:Ln}),gh.set(t,e)),e}const _h=[16735603,16765503,6219432,6210303,11832575,16752451],Ar=14,Rr=8,t_=.2,e_=Math.PI*2,xh=[];function n_(i,t){if(i.length!==t.length)return!1;for(let e=0;e<i.length;e++)if(i[e]!==t[e])return!1;return!0}function Cr(i,t,e,n){return i+(t-i)*(1-Math.exp(-e*n))}const i_=i=>{const t=i.provider,e=i.role,n=Wr[t],s=h1(i.seed,t),r=i.ownerColor?Tl(i.ownerColor,10133677):null,a=g1(s,t,e,r);let o=3,l="";const c=new kt;c.name="rig:"+i.name;const f=Object.values(a),h=(de,pe=Rn,Le=!0)=>{const Bi=new Rt(de,pe);return Le&&(Bi.castShadow=!0,Bi.receiveShadow=!0),Bi},u=new kt;c.add(u),u.add(h(a.pelvis));const p=new kt;u.add(p),p.add(h(a.torso));const g=h(a.badge,xn,!1);g.position.set(e==="worker"?.07:0,.3,-.168),p.add(g),p.add(h(a.pack));const _=new Xt({color:4906624}),m=h(qi.gaugeFill(),_,!1);m.position.set(0,.155,.298),p.add(m);const d=new Ua(qi.cartridge(),xn,4);d.frustumCulled=!1,p.add(d);const E=["","","",""],y=[0,0,0,0],S=new Tt;for(let de=0;de<4;de++)d.setColorAt(de,S.setHex(8947848));d.count=4;const O=new kt;O.position.y=on.headPivotY,p.add(O),O.add(h(a.head));const T=h(a.eyes,Rn,!1);T.position.set(0,.3,-.249),O.add(T);const R=h(a.mouth,Rn,!1);R.position.set(0,.13,-.249),O.add(R);const I=_1(s),b=new kt;b.position.y=I,O.add(b);let M=null,A=null,V=null;const z=de=>{l=de,o=f1(de),M&&(b.remove(M),M=null),A&&(b.remove(A),A=null),V&&(b.remove(V),V=null);const pe=x1(o,t);pe.body&&(M=h(pe.body,Rn,!1),b.add(M)),pe.glow&&(A=h(pe.glow,xn,!1),b.add(A)),pe.halo&&(V=h(pe.halo,xn,!1),b.add(V))},C=new kt;C.position.set(on.shoulderX,on.shoulderY,0);const W=new kt;W.position.set(-.35,on.shoulderY,0),p.add(C,W),C.add(h(a.upperR)),W.add(h(a.upperL));const G=new kt;G.position.y=-.27;const Z=new kt;Z.position.y=-.27,C.add(G),W.add(Z),G.add(h(a.foreR)),Z.add(h(a.foreL));const H=new kt;H.position.y=-.27;const it=new kt;it.position.y=-.27,G.add(H),Z.add(it);const ot=new kt;ot.position.set(on.hipX,0,0);const gt=new kt;gt.position.set(-.13,0,0),u.add(ot,gt),ot.add(h(a.thigh)),gt.add(h(a.thigh));const Ct=new kt;Ct.position.y=-.37;const Jt=new kt;Jt.position.y=-.37,ot.add(Ct),gt.add(Jt),Ct.add(h(a.shin)),Jt.add(h(a.shin));const Y=h(uh("tickets",1,[]),Rn,!0);Y.visible=!1,p.add(Y);let tt="",_t="tickets",st=1,Lt=[];const It=h(Xi.plane(),Rn,!1);It.visible=!1,p.add(It);const zt=new kt,_e=h(Xi.clipboard(),Rn,!1);_e.position.set(0,.1,-.1),_e.rotation.x=.3,zt.add(_e),zt.visible=!1;const qt=new kt,Se=h(Xi.sheet(),Rn,!1);Se.position.set(0,.1,-.05),Se.rotation.x=1.15,qt.add(Se),qt.visible=!1;const U=h(Xi.marker(),Rn,!1);U.visible=!1;const Ze=h(Xi.pen(),Rn,!1);Ze.visible=!1;const Gt=new kt,$t=h(Xi.stamp(),Rn,!1);$t.scale.setScalar(1.25),Gt.add($t),Gt.visible=!1,e==="orchestrator"&&(it.add(zt),H.add(U)),e!=="integrator"&&H.add(Ze),it.add(qt);let Et=null;e==="integrator"&&(H.add(Gt),Et=h(Xi.stamp(),Rn,!1),Et.position.set(-.31,.2,0),Et.rotation.z=.35,Et.scale.setScalar(.85),u.add(Et));const oe=new Xt({vertexColors:!0,transparent:!0,opacity:0,depthWrite:!1}),At=h(qi.flashShell(),oe,!1);At.scale.setScalar(1.08),At.visible=!1,u.add(At);const w=new Xt({vertexColors:!0,transparent:!0,opacity:0,depthWrite:!1}),x=h(qi.flashRing(),w,!1);x.visible=!1,c.add(x),f.push(oe,w,_);let B=-1;const $=new Rt(qi.selRing(),Q1(n.glow));$.position.y=.03,$.visible=!1,c.add($);const J=new kt;c.add(J);const K=h(ri.bang(),xn,!1),xt=h(ri.hourglass(),xn,!1),rt=[h(ri.z(.17),xn,!1),h(ri.z(.13),xn,!1),h(ri.z(.1),xn,!1)],pt=h(ri.pencil(),xn,!1),Zt=h(ri.think(),xn,!1),Q=h(ri.star(),xn,!1),mt=h(ri.question(),xn,!1),Dt=[K,xt,pt,Zt,Q,mt];J.add(K,xt,pt,Zt,Q,mt,rt[0],rt[1],rt[2]);for(const de of Dt)de.visible=!1;for(const de of rt)de.visible=!1;const ht=[0,0,0,0,0,0,0];pt.rotation.z=0,pt.scale.setScalar(.9);const ut=new Ua(qi.drone(t),xn,Rr);ut.frustumCulled=!1,ut.count=0,c.add(ut);const jt=new Float32Array(Rr),Ut=new Ua(qi.particle(),p1,Ar);Ut.frustumCulled=!1;for(let de=0;de<Ar;de++)Ut.setColorAt(de,S.setHex(_h[de%_h.length]));c.add(Ut);const Pt=new Float32Array(Ar*7);let L=0,lt=0;const X=new Float32Array(ks),j=new Float32Array(ks),dt=new Float32Array(ks),at=new Float32Array(ks),Ft={carry:!1,hasLast:!1,reachUp:!0,phase:s.phase,integrator:e==="integrator",orchestrator:e==="orchestrator"};let ye=s.phase*3.1,Vt=s.phase,ie=0,en=-1,Pe=1,nn="idle",ds=!1,sn=0,Un=0,ur=0,vi=on.legs,Oi=!0;const dr={object:c,headHeight:mh.headHeightStanding,flashCompaction(){B=0},update(de,pe){const Le=de>.1?.1:de<0?0:de,Bi=pe.speed>0?pe.speed:0,Xr=Le*Bi;ye+=Xr,Vt+=Le,ie+=Xr,pe.tier!==l&&z(pe.tier);const pr=pe.pose,v=pe.seated&&j1(pr),D=(Sf[pr]??0)*2+(v?1:0);D!==en&&(en>=0&&!Oi?(j.set(dt),Pe=0):Pe=1,en=D,ie=0,nn=pr,ds=v);const k=pe.carrying;k&&(_t=k.kind,st=k.count,Ft.hasLast=!0),Ft.carry=k!==null,Ft.reachUp=k?k.kind==="skills":!0,$1(nn,ds,X,ye,ie,Ft);const P=dt;if(Pe<1){Pe=Pe+Le/t_,Pe>1&&(Pe=1);const nt=Pe*Pe*(3-2*Pe);for(let Bt=0;Bt<ks;Bt++)P[Bt]=j[Bt]+(X[Bt]-j[Bt])*nt}else P.set(X);if(Oi=!1,sn=Cr(sn,k!==null&&!ds&&(nn==="idle"||nn==="wait"||nn==="walk"||nn==="blocked")?1:0,10,Le),sn>.002){at.fill(0),S1(at,.01*Math.sin(Vt*2));for(let nt=dn;nt<=Zn;nt++)P[nt]+=(at[nt]-P[nt])*sn;P[es]+=(at[es]-P[es])*sn,P[ns]+=(at[ns]-P[ns])*sn,P[is]+=(at[is]-P[is])*sn}const et=(on.thigh*Math.cos(P[Kn])+on.shin*Math.cos(P[Kn]-P[Ve]))*Math.cos(P[Hr]),ft=(on.thigh*Math.cos(P[pi])+on.shin*Math.cos(P[pi]-P[qe]))*Math.cos(P[Gr]),vt=et>ft?et:ft,St=on.legs-on.seatDrop,Nt=P[pf],Ot=vt+(St-vt)*Nt+P[Za];vi=Ot,ur=Nt,u.position.set(P[Ni],Ot,P[kr]),u.rotation.set(0,P[jl],P[hr]),p.rotation.set(-P[Ae],P[fr],P[Fi]),p.scale.y=1+.025*P[Mn],O.rotation.set(-P[Ye],P[gn],P[sr]),C.rotation.set(P[dn],0,P[rs]),W.rotation.set(P[pn],0,-P[as]),G.rotation.x=P[_i],Z.rotation.x=P[Zn],ot.rotation.set(P[Kn],0,P[Hr]),gt.rotation.set(P[pi],0,-P[Gr]),Ct.rotation.x=-P[Ve],Jt.rotation.x=-P[qe];const yt=(Vt*.29+s.phase)%1<.03?.1:1,Qt=P[Gn]*yt;T.scale.y=Qt<.06?.06:Qt,R.scale.set(1+.6*P[Al],.35+1.7*P[us],1),R.position.y=.13+.01*P[Al];const le=e==="orchestrator",me=e==="integrator",Ke=P[Ae]-P[dn]-P[_i],se=P[Ae]-P[pn]-P[Zn],Mt=nn==="review",wn=nn==="plan";zt.visible=le&&wn,U.visible=le&&wn,Ze.visible=!me&&Mt,qt.visible=Mt,qt.rotation.x=se,zt.rotation.x=se,me&&(Gt.visible=Mt,Gt.rotation.x=Ke,Et&&(Et.visible=!Mt));let te=P[is];if(!k&&nn!=="pickup"&&(te=0),te>.02){const nt=k?k.kind:_t,Bt=k?k.count:st,Ee=pe.skillColors||xh,ee=nt+Math.max(1,Math.min(df,Bt|0)),Me=nt==="skills"&&!n_(Ee,Lt);(ee!==tt||Me)&&(tt=ee,Lt=Ee.slice(),Y.geometry=uh(nt,Bt,Ee)),Y.visible=!0,Y.position.set(0,P[es],P[ns]),Y.scale.setScalar((te>1?1:te)*1.15)}else Y.visible=!1;P[Na]>.02&&nn==="throw"?(It.visible=!0,It.position.set(P[mf],P[gf],P[_f]),It.scale.setScalar(P[Na]>1?1:P[Na])):It.visible=!1;const _n=pe.contextFill<0?0:pe.contextFill>1?1:pe.contextFill;if(B>=0&&B<.22||(Un=Cr(Un,_n,_n<Un?6:10,Le)),m.scale.y=Un*.27<.004?.004:Un*.27,B>=0&&B<.22&&Math.floor(B*40)%2===0?_.color.setHex(16777215):Un>.9?_.color.setHex(Math.sin(Vt*12)>0?16726843:12854051):Un>.7?_.color.setHex(16758815):_.color.setHex(4906624),B>=0)if(B+=Le,B>.8)B=-1,At.visible=!1,x.visible=!1;else{const nt=.9*(1-B/.35);At.visible=nt>.01,oe.opacity=nt>0?nt:0;const Bt=B/.8;x.visible=!0,x.position.y=vi+.35,x.scale.setScalar(.6+2.6*(1-(1-Bt)*(1-Bt))),w.opacity=(1-Bt)*.95}if(A&&A.scale.setScalar(1+.12*Math.sin(Vt*4+1)),V&&(V.rotation.y=Vt*1.4,V.position.y=.02*Math.sin(Vt*2.5),V.scale.setScalar(1+.05*Math.sin(Vt*5))),pe.selected){$.visible=!0;const nt=1+.08*Math.sin(Vt*5);$.scale.set(nt,1,nt),g.scale.setScalar(1+.25*(.5+.5*Math.sin(Vt*5)))}else $.visible&&($.visible=!1,g.scale.setScalar(1));let $e=-1;switch(nn){case"blocked":$e=0;break;case"wait":$e=1;break;case"type":$e=2;break;case"think":$e=3;break;case"celebrate":$e=4;break;case"sleep":$e=5;break;case"raise_hand":$e=6;break}for(let nt=0;nt<7;nt++)ht[nt]=Cr(ht[nt],nt===$e?1:0,12,Le),ht[nt]<.01&&(ht[nt]=0);K.visible=ht[0]>0,K.scale.setScalar(ht[0]*(1+.1*Math.sin(Vt*9))),xt.visible=ht[1]>0,xt.scale.setScalar(ht[1]*.9),pt.visible=ht[2]>0,pt.scale.setScalar(ht[2]*.9),Zt.visible=ht[3]>0,Zt.scale.setScalar(ht[3]*1.2),Q.visible=ht[4]>0,Q.scale.setScalar(ht[4]*(1+.15*Math.sin(Vt*8))),mt.visible=ht[6]>0,mt.scale.setScalar(ht[6]*1.5*(1+.06*Math.sin(Vt*6)));for(let nt=0;nt<3;nt++){const Bt=rt[nt];if(Bt.visible=ht[5]>0,Bt.visible){const Ee=(Vt*.4+nt/3)%1;Bt.position.set(.05*nt-.05,-.18+.42*Ee,0),Bt.scale.setScalar(ht[5]*Math.sin(Math.PI*Ee)*1.15+.001)}}const rn=vi+on.torsoTop+I+u1[o]+.33;J.position.y=rn+.04*Math.sin(Vt*2.4),J.rotation.y=ht[5]>.5?.8*Math.sin(Vt*.9):ht[6]>.5?.9*Math.sin(Vt*1.1):Vt*1.1,J.visible=$e>=0||ht[0]+ht[1]+ht[2]+ht[3]+ht[4]+ht[5]+ht[6]>0;const Wn=pe.skillColors||xh,xe=Wn?Wn.length>4?4:Wn.length:0,ve=d.instanceMatrix.array;for(let nt=0;nt<4;nt++){let Bt=0;if(nt<xe){const we=Wn[nt];E[nt]===we?Bt=1:y[nt]>.05?Bt=0:(E[nt]=we,d.setColorAt(nt,S.setHex(Tl(we))),d.instanceColor&&(d.instanceColor.needsUpdate=!0),Bt=1)}y[nt]=Cr(y[nt],Bt,14,Le),Math.abs(y[nt]-Bt)<.01&&(y[nt]=Bt);const Ee=y[nt],ee=Ee*(1+.3*Math.sin(Math.PI*Ee))+1e-4,Me=nt*16;ve[Me]=ee,ve[Me+1]=0,ve[Me+2]=0,ve[Me+3]=0,ve[Me+4]=0,ve[Me+5]=ee,ve[Me+6]=0,ve[Me+7]=0,ve[Me+8]=0,ve[Me+9]=0,ve[Me+10]=ee,ve[Me+11]=0,ve[Me+12]=nt<2?-.14:.14,ve[Me+13]=.14+(nt&1)*.15,ve[Me+14]=.27,ve[Me+15]=1}d.instanceMatrix.needsUpdate=!0;const Qn=pe.subagents<0?0:pe.subagents>Rr?Rr:Math.round(pe.subagents),ce=ut.instanceMatrix.array;let Tn=0;for(let nt=0;nt<Rr;nt++){let Bt=Cr(jt[nt],nt<Qn?1:0,9,Le);Math.abs(Bt-(nt<Qn?1:0))<.005&&(Bt=nt<Qn?1:0),jt[nt]=Bt,Bt>0&&(Tn=nt+1);const Ee=Bt*(1+.35*Math.sin(Math.PI*Bt))+1e-4,ee=nt&1,Me=s_[nt],we=(ee?-.9:1.1)*Vt+Me*(Math.PI/4)*1,mr=.82+.16*ee+.05*Math.sin(Vt*1.7+nt),Af=(ee?1:1.5)+.08*Math.sin(Vt*2.1+nt*1.3)+0+(vi-on.legs)*.6,tc=-we+(ee?0:Math.PI)+Vt*.5,ec=Math.cos(tc)*Ee,nc=Math.sin(tc)*Ee,je=nt*16;ce[je]=ec,ce[je+1]=0,ce[je+2]=-nc,ce[je+3]=0,ce[je+4]=0,ce[je+5]=Ee,ce[je+6]=0,ce[je+7]=0,ce[je+8]=nc,ce[je+9]=0,ce[je+10]=ec,ce[je+11]=0,ce[je+12]=Math.cos(we)*mr,ce[je+13]=Af,ce[je+14]=Math.sin(we)*mr,ce[je+15]=1}ut.count=Tn,ut.visible=Tn>0,ut.instanceMatrix.needsUpdate=!0;const Nn=nn==="celebrate";if(Nn)for(L+=Le;L>.045;){L-=.045;for(let nt=0;nt<Ar;nt++){const Bt=nt*7;if(Pt[Bt+6]<=0){const Ee=Math.random()*e_,ee=.2+Math.random()*.5;Pt[Bt]=Math.cos(Ee)*.15,Pt[Bt+1]=vi+.9,Pt[Bt+2]=Math.sin(Ee)*.15,Pt[Bt+3]=Math.cos(Ee)*ee,Pt[Bt+4]=1.8+Math.random()*1.6,Pt[Bt+5]=Math.sin(Ee)*ee,Pt[Bt+6]=.7+Math.random()*.6;break}}}if(Nn||lt>0){const nt=Ut.instanceMatrix.array;let Bt=0;for(let Ee=0;Ee<Ar;Ee++){const ee=Ee*7;let Me=0;Pt[ee+6]>0&&(Pt[ee+6]-=Le,Pt[ee+4]-=7*Le,Pt[ee]+=Pt[ee+3]*Le,Pt[ee+1]+=Pt[ee+4]*Le,Pt[ee+2]+=Pt[ee+5]*Le,Pt[ee+1]<.05&&(Pt[ee+1]=.05,Pt[ee+4]=0,Pt[ee+3]*=.5,Pt[ee+5]*=.5),Me=Pt[ee+6]>0?Math.min(1,Pt[ee+6]*3):0,Me>0&&Bt++);const we=Ee*16,mr=Math.sin(Vt*8+Ee);nt[we]=Me*(.7+.3*mr),nt[we+1]=0,nt[we+2]=0,nt[we+3]=0,nt[we+4]=0,nt[we+5]=Me,nt[we+6]=0,nt[we+7]=0,nt[we+8]=0,nt[we+9]=0,nt[we+10]=Me*(.7+.3*mr),nt[we+11]=0,nt[we+12]=Pt[ee],nt[we+13]=Pt[ee+1],nt[we+14]=Pt[ee+2],nt[we+15]=1}lt=Bt,Ut.instanceMatrix.needsUpdate=!0,Ut.visible=!0}else Ut.visible=!1;dr.headHeight=mh.headHeightStanding-on.seatDrop*ur},dispose(){for(const de of f)de.dispose();ut.dispose(),Ut.dispose(),d.dispose(),c.removeFromParent()}};return z("sonnet"),dr},s_=[0,4,2,6,1,5,3,7],ba=Math.PI/180,Us=new F,Ai=new F,Ns=new F,ai=new F,r_=new F,yf=[];for(const i of[bt.minX-.6,bt.maxX+.3])for(const t of[-.8,bt.wallHeight])for(const e of[bt.minZ-.5,bt.maxZ+.3])yf.push(new F(i,t,e));class a_{constructor(t){this.el=t;const e=o=>{this.mode=o.button===2||o.shiftKey||o.button===1?"pan":"rotate",this.dragging=!0,this.moved=0,this.lastX=this.downX=o.clientX,this.lastY=this.downY=o.clientY;try{t.setPointerCapture(o.pointerId)}catch{}},n=o=>{if(!this.dragging){this.onHover?.(o.clientX,o.clientY);return}const l=o.clientX-this.lastX,c=o.clientY-this.lastY;if(this.lastX=o.clientX,this.lastY=o.clientY,this.moved+=Math.abs(l)+Math.abs(c),this.mode==="rotate")this.azimuth-=l*.006,this.elevation=qr.clamp(this.elevation+c*.005,12*ba,78*ba);else if(this.mode==="pan"){const f=this.halfH*2/Math.max(1,t.clientHeight);this.camera.matrixWorld.extractBasis(Ai,Ns,Us),ai.set(-Math.sin(this.azimuth),0,-Math.cos(this.azimuth)),this.target.addScaledVector(Ai,-l*f),this.target.addScaledVector(ai,c*f/Math.max(.25,Math.sin(this.elevation))),this.target.x=qr.clamp(this.target.x,bt.minX,bt.maxX),this.target.z=qr.clamp(this.target.z,bt.minZ,bt.maxZ)}},s=o=>{if(this.dragging){this.dragging=!1;try{t.releasePointerCapture(o.pointerId)}catch{}this.moved<5&&o.button===0&&this.onClick?.(o.clientX,o.clientY)}},r=o=>{o.preventDefault(),this.zoom=qr.clamp(this.zoom*Math.exp(-o.deltaY*.0012),.45,6)},a=o=>o.preventDefault();t.addEventListener("pointerdown",e),t.addEventListener("pointermove",n),t.addEventListener("pointerup",s),t.addEventListener("pointercancel",s),t.addEventListener("wheel",r,{passive:!1}),t.addEventListener("contextmenu",a),this.cleanup.push(()=>{t.removeEventListener("pointerdown",e),t.removeEventListener("pointermove",n),t.removeEventListener("pointerup",s),t.removeEventListener("pointercancel",s),t.removeEventListener("wheel",r),t.removeEventListener("contextmenu",a)})}camera=new Xa(-10,10,10,-10,1,200);azimuth=40*ba;elevation=36*ba;zoom=1;target=new F(0,1.2,.3);fit=12;fitInit=!1;focusCur=0;focusPos=new F;focusInit=!1;halfH=12;texelWorld=.05;dragging=!1;lastX=0;lastY=0;mode="none";moved=0;downX=0;downY=0;onClick=null;onHover=null;cleanup=[];reducedMotion=!1;getState(){return{azimuth:this.azimuth,elevation:this.elevation,zoom:this.zoom,target:{x:this.target.x,y:this.target.y,z:this.target.z}}}setState(t){t.azimuth!==void 0&&(this.azimuth=t.azimuth),t.elevation!==void 0&&(this.elevation=t.elevation),t.zoom!==void 0&&(this.zoom=t.zoom),t.target&&this.target.set(t.target.x,t.target.y,t.target.z)}computeFit(t){const e=Math.cos(this.elevation),n=Math.sin(this.elevation);Us.set(Math.sin(this.azimuth)*e,n,Math.cos(this.azimuth)*e),Ai.set(Math.cos(this.azimuth),0,-Math.sin(this.azimuth)),Ns.crossVectors(Us,Ai);let s=0,r=0;const a=0,o=1.4,l=0;for(const c of yf)ai.set(c.x-a,c.y-o,c.z-l),s=Math.max(s,Math.abs(ai.dot(Ai))),r=Math.max(r,Math.abs(ai.dot(Ns)));return Math.max(r,s/t)*1.04}update(t,e,n,s,r,a){const o=e/n;s.on&&!this.dragging&&!this.reducedMotion&&(this.azimuth+=s.speed*.12*t);const l=this.computeFit(o);this.fitInit?this.fit+=(l-this.fit)*(1-Math.exp(-6*t)):(this.fit=l,this.fitInit=!0);const c=a?r:0;this.focusCur+=(c-this.focusCur)*(1-Math.exp(-4*t)),a?this.focusInit?this.focusPos.lerp(a,1-Math.exp(-8*t)):(this.focusPos.copy(a),this.focusInit=!0):this.focusCur<.01&&(this.focusInit=!1);const f=this.focusCur,h=this.zoom*(1+f*2.6);this.halfH=this.fit/h;const u=this.halfH*o,p=this.camera;p.left=-u,p.right=u,p.top=this.halfH,p.bottom=-this.halfH,p.updateProjectionMatrix(),ai.copy(this.target),f>.001&&ai.lerp(r_.set(this.focusPos.x,.9,this.focusPos.z),f);const g=Math.cos(this.elevation),_=Math.sin(this.elevation);Us.set(Math.sin(this.azimuth)*g,_,Math.cos(this.azimuth)*g),p.position.copy(ai).addScaledVector(Us,90),p.lookAt(ai),p.updateMatrixWorld(),this.texelWorld=this.halfH*2/n;const m=this.texelWorld;p.matrixWorld.extractBasis(Ai,Ns,Us);const d=p.position.dot(Ai),E=p.position.dot(Ns);p.position.addScaledVector(Ai,Math.round(d/m)*m-d),p.position.addScaledVector(Ns,Math.round(E/m)*m-E),p.updateMatrixWorld()}dispose(){for(const t of this.cleanup)t();this.cleanup.length=0}}const Co={dusk:{clear:1709104,ambient:{color:9074888,intensity:1},hemi:{sky:11576564,ground:5915256,intensity:.6},sun:{color:16756848,intensity:1.05,pos:[-9,24,-6]},floorAisle:13081202,floorCarpet:8026548,wall:14136530,wallTrim:5915760,slab:2891840,rug:14714970,window:{top:5913242,bottom:16751194,city:2759242,lit:16765562,stars:!1},windowGlow:{color:16751184,opacity:.2},lampStrength:.8,posterTint:.95,screenGain:1,post:{levels:9,mono:0,ramp:[0,0,0],vignette:.28,contrast:1.08,saturation:1.08,lift:[.02,.01,.05],outline:.55}},day:{clear:11131893,ambient:{color:14937343,intensity:.8},hemi:{sky:14676479,ground:13153434,intensity:.6},sun:{color:16773584,intensity:1.05,pos:[-10,24,-7]},floorAisle:14203020,floorCarpet:8365769,wall:15985368,wallTrim:9075304,slab:6969932,rug:15237226,window:{top:7651583,bottom:13496063,city:9086656,lit:15922943,stars:!1},windowGlow:{color:16773312,opacity:.22},lampStrength:.12,posterTint:1,screenGain:.95,post:{levels:10,mono:0,ramp:[0,0,0],vignette:.12,contrast:1.04,saturation:1.05,lift:[0,0,0],outline:.4}},night:{clear:461338,ambient:{color:5926072,intensity:1.05},hemi:{sky:7375056,ground:2763346,intensity:.6},sun:{color:9086704,intensity:.7,pos:[-10,22,-6]},floorAisle:11042920,floorCarpet:5925032,wall:10522832,wallTrim:2762056,slab:1315880,rug:11557464,window:{top:461348,bottom:1714778,city:658978,lit:16769162,stars:!0},windowGlow:{color:6982368,opacity:.12},lampStrength:1.7,posterTint:.7,screenGain:1.25,post:{levels:8,mono:0,ramp:[0,0,0],vignette:.4,contrast:1.12,saturation:1.1,lift:[0,.01,.04],outline:.6}},terminal:{clear:133637,ambient:{color:5242752,intensity:.7},hemi:{sky:5963664,ground:1063450,intensity:.45},sun:{color:14221210,intensity:1,pos:[-14,18,-8]},floorAisle:7311210,floorCarpet:4880982,wall:9091216,wallTrim:1718818,slab:399372,rug:10127946,window:{top:271886,bottom:1739322,city:201994,lit:11927418,stars:!0},windowGlow:{color:5832592,opacity:.14},lampStrength:.9,posterTint:.9,screenGain:1.2,post:{levels:8,mono:.88,ramp:[135176,2076746,13303706],vignette:.4,contrast:1.15,saturation:1,lift:[0,.01,0],outline:.6}}},o_=`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`,l_=`
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uRes;       // render-target size in texels
uniform float uDither;
uniform float uLevels;
uniform float uOutline;
uniform float uOutlineThresh;
uniform float uMono;
uniform vec3 uRamp0; uniform vec3 uRamp1; uniform vec3 uRamp2;
uniform float uVignette;
uniform float uContrast;
uniform float uSaturation;
uniform vec3 uLift;

float bayer2(vec2 a) { a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }
float bayer4(vec2 p) { return bayer2(p) + bayer2(floor(p * 0.5)) * 0.25; }

vec3 toSrgb(vec3 c) {
  c = max(c, vec3(0.0));
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec2 px = 1.0 / uRes;
  vec3 col = texture2D(tColor, vUv).rgb;
  float d = texture2D(tDepth, vUv).x;
  // Outline from the SECOND difference of depth. Orthographic depth is linear, so a flat (even very oblique) plane has
  // d(+1) + d(-1) - 2 d == 0 and is never outlined, whatever the camera elevation. A first-difference test flagged the
  // whole floor as an edge once depth-per-texel (texel * cot(elevation)) exceeded the threshold -> ground "flashed".
  // s > 0: this pixel is nearer than the average of its neighbours -> silhouette on the near object.
  float dxp = texture2D(tDepth, vUv + vec2(px.x, 0.0)).x, dxn = texture2D(tDepth, vUv - vec2(px.x, 0.0)).x;
  float dyp = texture2D(tDepth, vUv + vec2(0.0, px.y)).x, dyn = texture2D(tDepth, vUv - vec2(0.0, px.y)).x;
  float s2 = max(dxp + dxn - 2.0 * d, dyp + dyn - 2.0 * d);
  float edge = step(uOutlineThresh, s2);
  col *= 1.0 - edge * uOutline;

  vec3 s = toSrgb(col);
  // grade
  float lum = dot(s, vec3(0.299, 0.587, 0.114));
  s = mix(vec3(lum), s, uSaturation);
  s = (s - 0.5) * uContrast + 0.5;
  s += uLift * (1.0 - lum);
  // vignette
  vec2 q = vUv - 0.5;
  s *= 1.0 - uVignette * smoothstep(0.25, 0.85, length(q * vec2(1.15, 1.0)) * 1.25);
  // mono ramp (terminal)
  if (uMono > 0.0) {
    float l = clamp(dot(s, vec3(0.299, 0.587, 0.114)) * 1.35, 0.0, 1.0);
    vec3 r = l < 0.5 ? mix(uRamp0, uRamp1, l * 2.0) : mix(uRamp1, uRamp2, (l - 0.5) * 2.0);
    s = mix(s, r, uMono);
  }
  // ordered dither + quantise
  vec2 cell = floor(vUv * uRes);
  float b = bayer4(cell) - 0.47;
  float lv = uLevels - 1.0;
  s = floor(clamp(s + b * uDither / lv, 0.0, 1.0) * lv + 0.5) / lv;
  gl_FragColor = vec4(s, 1.0);
}
`;class c_{constructor(t){this.renderer=t;const e=t.extensions.has("EXT_color_buffer_float")||t.extensions.has("EXT_color_buffer_half_float");this.rt=new Ui(2,2,{minFilter:Ne,magFilter:Ne,type:e?ar:jn,depthBuffer:!0,generateMipmaps:!1});const n=new Zl(2,2);n.minFilter=Ne,n.magFilter=Ne,this.rt.depthTexture=n,this.mat=new gi({vertexShader:o_,fragmentShader:l_,depthTest:!1,depthWrite:!1,uniforms:{tColor:{value:this.rt.texture},tDepth:{value:n},uRes:{value:new Yt(2,2)},uDither:{value:.35},uLevels:{value:9},uOutline:{value:.5},uOutlineThresh:{value:.0022},uMono:{value:0},uRamp0:{value:new Tt},uRamp1:{value:new Tt},uRamp2:{value:new Tt},uVignette:{value:.25},uContrast:{value:1},uSaturation:{value:1},uLift:{value:new F}}});const s=new Rt(new Te(2,2),this.mat);s.frustumCulled=!1,this.quadScene.add(s)}rt;width=2;height=2;quadScene=new lf;quadCam=new Xa(-1,1,1,-1,0,1);mat;pixelSize=3;setSize(t,e,n){this.pixelSize=Math.max(1,n);const s=Math.max(2,Math.ceil(t/this.pixelSize)),r=Math.max(2,Math.ceil(e/this.pixelSize));return(s!==this.width||r!==this.height)&&(this.width=s,this.height=r,this.rt.setSize(s,r),this.mat.uniforms.uRes.value.set(s,r)),{w:s,h:r}}setOutlineWorld(t,e){this.mat.uniforms.uOutlineThresh.value=t/e}setParams(t,e){const n=this.mat.uniforms;n.uDither.value=e,n.uLevels.value=t.post.levels,n.uOutline.value=t.post.outline,n.uMono.value=t.post.mono;for(let s=0;s<3;s++){const r=t.post.ramp[s];n["uRamp"+s].value.setRGB((r>>16&255)/255,(r>>8&255)/255,(r&255)/255,ls)}n.uVignette.value=t.post.vignette,n.uContrast.value=t.post.contrast,n.uSaturation.value=t.post.saturation,n.uLift.value.set(...t.post.lift)}render(t,e){const n=this.renderer;n.setRenderTarget(this.rt),n.clear(),n.render(t,e),n.setRenderTarget(null),n.render(this.quadScene,this.quadCam)}dispose(){this.rt.dispose(),this.rt.depthTexture?.dispose(),this.mat.dispose()}}function Jn(i){let t=i>>>0;return()=>{t=t+1831565813>>>0;let e=t;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}}const Po=[1,-1,-1,1,1,-1,1,1,1,1,-1,1,-1,-1,1,-1,1,1,-1,1,-1,-1,-1,-1,-1,1,-1,-1,1,1,1,1,1,1,1,-1,-1,-1,1,-1,-1,-1,1,-1,-1,1,-1,1,-1,-1,1,1,-1,1,1,1,1,-1,1,1,1,-1,-1,-1,-1,-1,-1,1,-1,1,1,-1],oi=[1,0,0,-1,0,0,0,1,0,0,-1,0,0,0,1,0,0,-1],Ri=new Tt,vh=new ue,Ea=new cs,Mh=new In,h_=new F,Sh=new F,Fs=new F;class be{pos=[];nor=[];col=[];idx=[];box(t,e,n,s,r,a,o,l=0,c=0,f=0){Ri.set(o),Mh.set(c,l,f,"YXZ"),Ea.setFromEuler(Mh),Sh.set(t,e,n),vh.compose(Sh,Ea,h_.set(1,1,1));const h=this.pos.length/3,u=s/2,p=r/2,g=a/2,_=l!==0||c!==0||f!==0;for(let m=0;m<6;m++){const d=m*3;_&&Fs.set(oi[d],oi[d+1],oi[d+2]).applyQuaternion(Ea);for(let y=0;y<4;y++){const S=m*12+y*3;if(Fs.set(Po[S]*u,Po[S+1]*p,Po[S+2]*g).applyMatrix4(vh),this.pos.push(Fs.x,Fs.y,Fs.z),_){const O=Fs.set(oi[d],oi[d+1],oi[d+2]).applyQuaternion(Ea);this.nor.push(O.x,O.y,O.z)}else this.nor.push(oi[d],oi[d+1],oi[d+2]);this.col.push(Ri.r,Ri.g,Ri.b)}const E=h+m*4;this.idx.push(E,E+1,E+2,E,E+2,E+3)}return this}top(t,e,n,s,r,a){Ri.set(a);const o=this.pos.length/3;this.pos.push(t,r,e,t,r,s,n,r,s,n,r,e);for(let l=0;l<4;l++)this.nor.push(0,1,0),this.col.push(Ri.r,Ri.g,Ri.b);return this.idx.push(o,o+1,o+2,o,o+2,o+3),this}get empty(){return this.pos.length===0}build(){const t=new Ge;return t.setAttribute("position",new Ce(this.pos,3)),t.setAttribute("normal",new Ce(this.nor,3)),t.setAttribute("color",new Ce(this.col,3)),t.setIndex(this.idx.length>65e3?new Xl(this.idx,1):new Wl(this.idx,1)),t.computeBoundingSphere(),t}}function Fe(i,t,e=!0,n=!0){const s=new Rt(i.build(),t);return s.castShadow=e,s.receiveShadow=n,s}const Cl=Dh(i=>Dl[i].accent.main),f_=["#5ad17a","#b9e04a","#f2c94c","#f08a3c","#e5484d"];function Ka(i,t,e,n=1,s=1,r=0){const a=Jn(s);i.box(t,r+.17*n,e,.42*n,.34*n,.42*n,10510394),i.box(t,r+.35*n,e,.46*n,.05*n,.46*n,6962982),i.box(t,r+.37*n,e,.36*n,.03*n,.36*n,3811870);const o=[4168266,5683290,3111484,7524202];for(let l=0;l<6;l++){const c=a()*Math.PI*2,f=.06+a()*.12*n,h=(.25+a()*.45)*n;i.box(t+Math.cos(c)*f,r+.4*n+h/2,e+Math.sin(c)*f,(.16+a()*.1)*n,h,(.16+a()*.1)*n,o[l%4],a()*1.5)}i.box(t,r+.4*n+.65*n,e,.3*n,.22*n,.3*n,o[3],a())}function Os(i,t,e,n=1){const s=Jn(n);i.box(t,.3,e,.7,.6,.7,12085822),i.box(t,.62,e,.76,.06,.76,8013096),i.box(t,.64,e,.6,.03,.6,3811870);const r=[4168266,5683290,3111484,7524202];i.box(t,1,e,.12,.8,.12,6965802);for(let a=0;a<9;a++){const o=a/9*Math.PI*2+s(),l=.2+s()*.25,c=1+s()*.9;i.box(t+Math.cos(o)*l,c,e+Math.sin(o)*l,.34,.28,.34,r[a%4],s()*1.5)}i.box(t,2.1,e,.45,.32,.45,r[3],.4)}function $a(i,t,e,n,s){i.box(t,e+.05,n,.09,.1,.09,s),i.box(t+.055,e+.05,n,.025,.06,.03,s),i.box(t,e+.101,n,.07,.01,.07,3810328)}function u_(i,t,e,n){i.box(t,e+.04,n,.12,.08,.1,16765498),i.box(t,e+.11,n-.03,.07,.07,.07,16765498),i.box(t,e+.1,n-.075,.04,.02,.035,16747050)}function d_(i,t,e,n,s,r){i.box(t,e+.01,n,.12,.02,.12,2763322),i.box(t,e+.09,n,.07,.14,.05,s),i.box(t,e+.2,n,.07,.07,.07,r)}function p_(i,t,e,n,s){const r=Jn(s),a=[13652554,4883152,5945456,14725184,9067192];let o=e;for(let l=0;l<3;l++){const c=.04+r()*.03;i.box(t+(r()-.5)*.02,o+c/2,n,.26-l*.02,c,.19,a[Math.floor(r()*a.length)],(r()-.5)*.3),o+=c}}function m_(i,t,e,n){i.box(t,e+.04,n,.12,.08,.12,12085822),i.box(t,e+.14,n,.07,.15,.07,4890714),i.box(t+.06,e+.15,n,.05,.03,.04,4890714),i.box(t+.08,e+.19,n,.03,.08,.04,4890714),i.box(t,e+.23,n,.03,.02,.03,16743080)}function g_(i,t,e,n,s){i.box(t,e+.08,n,.2,.15,.025,3811870,0,-.2),i.box(t,e+.08,n+.006,.16,.11,.025,s,0,-.2)}function bf(i,t,e,n,s,r,a=16183779,o=.34,l=.46,c=4878288){const f=Jn(r),h=.022;for(let u=0;u<s;u++){const g=.93+f()*.07;i.box(t+(f()-.5)*.025,e+h*(u+.5),n+(f()-.5)*.025,o,h*.9,l,g>.97?a:Ef(a,g),(f()-.5)*.12)}return i.box(t,e+h*s+.003,n-l*.3,o*.8,.004,l*.12,c),h*s+.006}function Ef(i,t){const e=Math.round((i>>16&255)*t),n=Math.round((i>>8&255)*t),s=Math.round((i&255)*t);return e<<16|n<<8|s}function __(i,t,e,n,s=2763316){i.box(t,e+.02,n,.16,.04,.16,s),i.box(t,e+.2,n,.03,.34,.03,s,0,0,.12),i.box(t-.04,e+.38,n,.18,.025,.03,s,0,0,0)}function x_(i,t,e){i.box(t,.45,e,.6,.9,.55,15265524),i.box(t,.9,e,.62,.05,.57,13226972),i.box(t+.26,.55,e,.06,.1,.18,5945599),i.box(t+.26,.4,e,.06,.1,.18,16738906),i.box(t+.22,.3,e,.12,.03,.22,9082530),i.box(t,1.28,e,.46,.65,.46,8308991),i.box(t,1.28,e,.38,.55,.38,11920639),i.box(t,1.62,e,.2,.06,.2,8308991)}function v_(i,t,e,n){const s=(e+n)/2,r=n-e;i.box(t,.45,s,.8,.9,r,9071178),i.box(t,.93,s,.86,.06,r+.04,14271648),i.box(t+.41,.45,s,.03,.8,r-.1,6965802),i.box(t-.1,1.2,s-.5,.45,.5,.5,2764346),i.box(t+.14,1.2,s-.5,.04,.42,.42,3817552),i.box(t+.15,1.3,s-.5,.03,.08,.2,16734794),i.box(t+.15,1.05,s-.5,.05,.14,.1,1710626),i.box(t+.17,.99,s-.5,.1,.05,.1,15790320),i.box(t-.05,1.05,s+.15,.25,.2,.25,12634320),i.box(t-.05,1.18,s+.15,.12,.06,.12,3816004);for(let a=0;a<4;a++)$a(i,t+.1,.96,s+.45+a*.14,[13652554,4883152,16765530,15790320][a]);i.box(t-.1,1.06,s+.85,.18,.22,.18,15260864),i.box(t-.1,1.2,s+.85,.2,.06,.2,13654602)}function M_(i,t,e,n,s,r){const a=Jn(r);let o=n;const l=[13652554,4883152,5945456,14725184,9067192,14251863,3003583,15261904];for(;o<s-.1;){const c=.07+a()*.08,f=.4+a()*.25;i.box(t,e+f/2,o+c/2,.35,f,c,l[Math.floor(a()*l.length)]),o+=c+.01}}function S_(){const i=new Li({vertexColors:!0}),t={...Cl,off:3816778},e={},n={};for(const s of[...Rf,"off"])e[s]=new Li({color:t[s]}),n[s]=new Xt({color:s==="off"?2763828:t[s],toneMapped:!1}),s!=="off"&&n[s].color.multiplyScalar(1.25);return{vc:i,lam:e,lampOn:n,invisible:new Xt({visible:!1}),glowBase:new Xt}}const wf={A:[14,17,17,31,17,17,17],B:[30,17,17,30,17,17,30],C:[14,17,16,16,16,17,14],D:[30,17,17,17,17,17,30],E:[31,16,16,30,16,16,31],F:[31,16,16,30,16,16,16],G:[14,17,16,23,17,17,15],H:[17,17,17,31,17,17,17],I:[14,4,4,4,4,4,14],J:[7,2,2,2,2,18,12],K:[17,18,20,24,20,18,17],L:[16,16,16,16,16,16,31],M:[17,27,21,21,17,17,17],N:[17,17,25,21,19,17,17],O:[14,17,17,17,17,17,14],P:[30,17,17,30,16,16,16],Q:[14,17,17,17,21,18,13],R:[30,17,17,30,20,18,17],S:[15,16,16,14,1,1,30],T:[31,4,4,4,4,4,4],U:[17,17,17,17,17,17,14],V:[17,17,17,17,17,10,4],W:[17,17,17,21,21,27,17],X:[17,17,10,4,10,17,17],Y:[17,17,10,4,4,4,4],Z:[31,1,2,4,8,16,31],0:[14,17,19,21,25,17,14],1:[4,12,4,4,4,4,14],2:[14,17,1,2,4,8,31],3:[31,2,4,2,1,17,14],4:[2,6,10,18,31,2,2],5:[31,16,30,1,1,17,14],6:[6,8,16,30,17,17,14],7:[31,1,2,4,8,8,8],8:[14,17,17,14,17,17,14],9:[14,17,17,15,1,2,12],"-":[0,0,0,31,0,0,0],".":[0,0,0,0,0,12,12],":":[0,12,12,0,12,12,0],"!":[4,4,4,4,4,0,4],"?":[14,17,1,2,4,0,4],"/":[1,1,2,4,8,16,16],"#":[10,10,31,10,31,10,10],">":[16,8,4,2,4,8,16],"<":[1,2,4,8,4,2,1],"+":[0,4,4,31,4,4,0],",":[0,0,0,0,12,4,8],"'":[4,4,8,0,0,0,0],"%":[25,25,2,4,8,19,19],_:[0,0,0,0,0,0,31],"(":[2,4,8,8,8,4,2],")":[8,4,2,2,2,4,8],"*":[0,21,14,31,14,21,0],"=":[0,0,31,0,31,0,0],$:[4,15,20,14,5,30,4],"@":[14,17,23,21,23,16,14],"[":[14,8,8,8,8,8,14],"]":[14,2,2,2,2,2,14],"|":[4,4,4,4,4,4,4],"~":[0,0,8,21,2,0,0],"&":[12,18,20,8,21,18,13]," ":[0,0,0,0,0,0,0]},y_=wf[" "];function un(i,t=1){return i.length===0?0:(i.length*6-1)*t}function ne(i,t,e,n,s,r=1){i.fillStyle=s;let a=Math.round(e);const o=Math.round(n);for(let l=0;l<t.length;l++){const c=wf[t[l].toUpperCase()]??y_;for(let f=0;f<7;f++){const h=c[f];if(h)for(let u=0;u<5;u++)h&16>>u&&i.fillRect(a+u*r,o+f*r,r,r)}a+=6*r}return a}function re(i,t,e,n,s,r=1){ne(i,t,e-un(t,r)/2,n,s,r)}function Vn(i,t,e=!0){const n=document.createElement("canvas");n.width=i,n.height=t;const s=n.getContext("2d");s.imageSmoothingEnabled=!1;const r=new uf(n);return r.colorSpace=hn,r.magFilter=Ne,r.minFilter=e?Pi:Ne,r.generateMipmaps=e,r.anisotropy=4,{canvas:n,ctx:s,tex:r}}function Lo(i){return"#"+i.toString(16).padStart(6,"0")}let Pr=null;function os(){if(Pr)return Pr;const i=document.createElement("canvas");i.width=i.height=64;const t=i.getContext("2d"),e=t.createRadialGradient(32,32,0,32,32,32);return e.addColorStop(0,"rgba(255,255,255,1)"),e.addColorStop(.35,"rgba(255,255,255,0.55)"),e.addColorStop(.7,"rgba(255,255,255,0.15)"),e.addColorStop(1,"rgba(255,255,255,0)"),t.fillStyle=e,t.fillRect(0,0,64,64),Pr=new uf(i),Pr.colorSpace=hn,Pr}function b_(i,t,e,n){const s=new Tt(n.window.top),r=new Tt(n.window.bottom),a=new Tt,o=10;for(let h=0;h<o;h++)a.copy(s).lerp(r,h/(o-1)),i.fillStyle="#"+a.getHexString(hn),i.fillRect(0,Math.floor(e*h/o),t,Math.ceil(e/o)+1);const l=Jn(11);if(n.window.stars){i.fillStyle="#ffffff";for(let h=0;h<12;h++)i.fillRect(Math.floor(l()*t),Math.floor(l()*e*.55),1,1)}else i.fillStyle="rgba(255,255,255,0.35)",i.fillRect(4,5,8,2),i.fillRect(7,3,6,2),i.fillRect(t-14,8,9,2);i.fillStyle=Lo(n.window.city);let c=0;const f=Lo(n.window.lit);for(;c<t;){const h=3+Math.floor(l()*5),u=6+Math.floor(l()*12);i.fillStyle=Lo(n.window.city),i.fillRect(c,e-u,h,u),i.fillStyle=f;for(let p=e-u+2;p<e-1;p+=3)for(let g=c+1;g<c+h-1;g+=2)l()<.45&&i.fillRect(g,p,1,1);c+=h}}function E_(i,t,e,n){const s={shipit:["#2a1a5a","#ff7a45","#fff1c8"],blame:["#f5ecd0","#2a2a3a","#d94a3a"],works:["#1a2a4a","#9bd1ff","#ffd25a"],nap:["#7ad1b8","#1f3a4a","#fff1c8"],coffee:["#5a3a2a","#f5d2a0","#ff9a4a"],agile:["#ffd25a","#2a2a3a","#d94a3a"]},[r,a,o]=s[n];i.fillStyle=r,i.fillRect(0,0,t,e),i.fillStyle=a,i.fillRect(0,0,t,2),i.fillRect(0,e-2,t,2),i.fillRect(0,0,2,e),i.fillRect(t-2,0,2,e);const l=t/2;if(n==="shipit")i.fillStyle="#ffffff",i.fillRect(l-4,12,8,22),i.fillStyle="#ff5a4a",i.fillRect(l-3,8,6,4),i.fillRect(l-1,5,2,3),i.fillStyle="#ff5a4a",i.fillRect(l-8,28,4,8),i.fillRect(l+4,28,4,8),i.fillStyle="#4ac8ff",i.fillRect(l-2,17,4,4),i.fillStyle=o,i.fillRect(l-3,34,6,5),i.fillStyle="#ffd25a",i.fillRect(l-1,39,2,5),re(i,"SHIP",l,50,o,1),re(i,"IT",l,59,o,1);else if(n==="blame")re(i,"GIT",l,8,o,2),re(i,"BLAME",l,26,a,1),re(i,"IS A",l,38,a,1),re(i,"LIFE",l,50,o,1),re(i,"STYLE",l,60,o,1);else if(n==="works")re(i,"WORKS",l,10,o,1),re(i,"ON MY",l,22,o,1),re(i,"MACHINE",l,34,o,1),i.fillStyle=a,i.fillRect(l-9,46,18,12),i.fillStyle="#10182a",i.fillRect(l-7,48,14,8),i.fillStyle=o,i.fillRect(l-5,50,4,1),i.fillRect(l-5,52,8,1);else if(n==="nap")re(i,"TODO:",l,10,a,1),re(i,"NAP",l,24,o,2),ne(i,"Z",l+4,44,a,1),ne(i,"Z",l+12,38,a,2),i.fillStyle=a,i.fillRect(l-14,52,20,6),i.fillStyle=o,i.fillRect(l-14,50,8,3);else if(n==="coffee")re(i,"COFFEE",l,8,o,1),i.fillStyle=a,i.fillRect(l-9,26,18,18),i.fillRect(l+9,30,4,8),i.fillStyle=r,i.fillRect(l+11,32,0,0),i.fillStyle="#7a4a2a",i.fillRect(l-7,28,14,4),i.fillStyle=o,i.fillRect(l-5,14,2,8),i.fillRect(l,12,2,10),i.fillRect(l+5,15,2,7),re(i,"IS",l,50,a,1),re(i,"LIFE",l,59,o,1);else{re(i,"AGILE",l,8,a,1);for(let c=0;c<3;c++)i.fillStyle=["#ff7a45","#4ac8ff","#5ad17a"][c],i.fillRect(8,20+c*12,12,8),i.fillRect(24,22+c*12,t-34,4);re(i,"SHIP",l,58,o,1)}}function Tf(i,t,e,n,s=1,r=4,a=3){const o=un(i,s)+r*2+2,l=7*s+a*2+2,c=Vn(o,l,!1);return c.ctx.fillStyle=n,c.ctx.fillRect(0,0,o,l),c.ctx.fillStyle=t,c.ctx.fillRect(1,1,o-2,l-2),ne(c.ctx,i,r+1,a+1,e,s),c.tex.needsUpdate=!0,{tex:c.tex,aspect:o/l}}const yh=[{wall:"N",at:-12.2,y:3.95,w:1.7,h:1.1},{wall:"N",at:-7.5,y:4.05,w:2.8,h:.95},{wall:"N",at:9.7,y:3.95,w:1.9,h:1.1},{wall:"W",at:-6.4,y:2.8,w:2,h:2.2},{wall:"W",at:7.8,y:2.9,w:2.2,h:2},{wall:"W",at:4.9,y:3.9,w:1.4,h:1},{wall:"W",at:-9.6,y:3.9,w:1.4,h:1}],w_=[{wall:"N",at:12.2,y:3.95,kind:"shipit",w:1.2,h:1.55},{wall:"N",at:-10.45,y:2.1,kind:"agile",w:.8,h:1.05},{wall:"W",at:-3.6,y:2.9,kind:"works",w:1.3,h:1.65},{wall:"W",at:6.35,y:2.3,kind:"nap",w:1,h:1.2},{wall:"W",at:10.2,y:3,kind:"blame",w:1.2,h:1.55},{wall:"N",at:11,y:1.9,kind:"coffee",w:.7,h:.9}];class T_{group=new kt;matAisle=new Li({vertexColors:!0});matCarpet=new Li({vertexColors:!0});matWall=new Li({vertexColors:!0});matSlab=new Li({vertexColors:!0});winTex=Vn(40,26,!0);winMat=new Xt({map:this.winTex.tex,toneMapped:!1});tints=[];patchMat=new Xt({map:os(),transparent:!0,opacity:.2,blending:$n,depthWrite:!1,toneMapped:!1});patchMesh;lastPal=null;tint=t=>{this.tints.push(t)};constructor(t){const e=this.group,n=bt.maxX-bt.minX,s=bt.maxZ-bt.minZ,r=new be,a=Jn(3);for(let C=bt.minX;C<bt.maxX;C++)for(let W=bt.minZ;W<bt.maxZ;W++){const Z=(C+W&1?.93:1)*(.97+a()*.03),H=new Tt(Z,Z,Z),it=new Tt(Z*.78,Z*.78,Z*.78);r.top(C+.04,W+.04,C+1,W+1,0,H),r.top(C,W,C+.04,W+1,0,it),r.top(C+.04,W,C+1,W+.04,0,it)}const o=new Rt(r.build(),this.matAisle);o.receiveShadow=!0,e.add(o);const l=new be;for(const C of Il){const{x:W,z:G}=C.center;l.box(W,.02,G,ci.width-.1,.04,ci.depth-.1,new Tt(.78,.78,.78)),l.box(W,.022,G,ci.width-.34,.044,ci.depth-.34,new Tt(1,1,1));for(let Z=0;Z<6;Z++)l.box(W-1.3+Z*.52,.0445,G+.1,.02,.001,ci.depth-.5,new Tt(.94,.94,.94))}const c=new Rt(l.build(),this.matCarpet);c.receiveShadow=!0,e.add(c);const f=new be,h=new Tt(1,1,1),u=new Tt(.7,.7,.7);f.box(0,-.43,0,n+.6,.8,s+.6,u),f.box(0,-.78,0,n+.9,.04,s+.9,new Tt(.5,.5,.5)),f.box(0,.09,bt.maxZ+.1,n+.3,.18,.22,h),f.box(bt.maxX+.1,.09,0,.22,.18,s+.3,h);const p=new Rt(f.build(),this.matSlab);p.receiveShadow=!0,e.add(p);const g=new be,_=bt.wallHeight,m=.3,d=(C,W,G,Z,H,it,ot)=>g.box(C,W,G,Z,H,it,new Tt(ot,ot,ot));d(0,_/2,bt.minZ-m/2,n+m,_,m,1),d(0,.45,bt.minZ+.02,n,.9,.04,.82),d(0,.92,bt.minZ+.04,n,.07,.08,.55),d(0,.13,bt.minZ+.05,n,.26,.1,.5),d(0,_-.1,bt.minZ+.04,n,.2,.08,.5),d(bt.minX-m/2,_/2,0,m,_,s,.94),d(bt.minX+.02,.45,0,.04,.9,s,.78),d(bt.minX+.04,.92,0,.08,.07,s,.52),d(bt.minX+.05,.13,0,.1,.26,s,.48),d(bt.minX+.04,_-.1,0,.08,.2,s,.48);const E=new Rt(g.build(),this.matWall);E.receiveShadow=!0,e.add(E);const y=new be,S=15722202,O=12101776,T=new Map;for(const C of yh){const W=C.w+"x"+C.h;let G=T.get(W);G||(G=new Te(C.w,C.h),T.set(W,G));const Z=new Rt(G,this.winMat),H=C.wall==="N",it=H?C.at:bt.minX+.05,ot=H?bt.minZ+.05:C.at;Z.position.set(it,C.y,ot),H||(Z.rotation.y=Math.PI/2),e.add(Z);const gt=(Jt,Y,tt,_t,st,Lt=.1)=>{H?y.box(C.at+Jt,C.y+Y,bt.minZ+.07,tt,_t,Lt,st):y.box(bt.minX+.07,C.y+Y,C.at+Jt,Lt,_t,tt,st)},Ct=.09;gt(0,C.h/2+Ct/2,C.w+Ct*2,Ct,S),gt(0,-C.h/2-Ct/2,C.w+Ct*2,Ct,S),gt(-C.w/2-Ct/2,0,Ct,C.h,S),gt(C.w/2+Ct/2,0,Ct,C.h,S),gt(0,0,.05,C.h,O,.12),C.h>1.4&&gt(0,0,C.w,.05,O,.12),gt(0,-C.h/2-Ct-.04,C.w+.3,.06,S,.22)}for(const C of w_){const W=Vn(56,72,!0);E_(W.ctx,56,72,C.kind),W.tex.needsUpdate=!0;const G=new Xt({map:W.tex,toneMapped:!1});this.tints.push(G);const Z=new Rt(new Te(C.w,C.h),G),H=C.wall==="N";Z.position.set(H?C.at:bt.minX+.1,C.y,H?bt.minZ+.1:C.at),H||(Z.rotation.y=Math.PI/2),e.add(Z),H?y.box(C.at,C.y,bt.minZ+.055,C.w+.1,C.h+.1,.04,2760752):y.box(bt.minX+.055,C.y,C.at,.04,C.h+.1,C.w+.1,2760752)}Os(y,bt.minX+.7,bt.minZ+.8,1),Os(y,bt.maxX-.8,bt.maxZ-1,2),Os(y,bt.maxX-.8,1.2,3),Os(y,bt.minX+.8,bt.maxZ-1,4),Os(y,4.3,bt.minZ+.8,5),Os(y,-4.5,bt.minZ+.8,6),x_(y,bt.minX+.6,5.4),v_(y,bt.minX+.6,7,9.9),y.box(bt.maxX-.5,.25,4,.6,.5,2.4,5917290),y.box(bt.maxX-.5,.52,4,.66,.08,2.5,9075368),Ka(y,bt.maxX-.5,4,.6,9,.56),y.box(0,.025,bt.maxZ-.6,3.4,.03,1,3813448),y.box(0,.04,bt.maxZ-.6,3,.01,.7,5917304);const R=Fe(y,t.vc);e.add(R);const I=[],b=[],M=[];let A=0;const V=(C,W,G,Z,H,it)=>{I.push(C,.062,W,G,.062,Z,G+H,.062,Z+it,C+H,.062,W+it),b.push(0,0,1,0,1,1,0,1),M.push(A,A+1,A+2,A,A+2,A+3),A+=4};for(const C of yh)C.w<1.5||(C.wall==="W"?V(bt.minX,C.at-C.w/2,bt.minX,C.at+C.w/2,5.2,1.4):V(C.at-C.w/2,bt.minZ,C.at+C.w/2,bt.minZ,1.8,4.6));const z=new Ge;z.setAttribute("position",new Ce(I,3)),z.setAttribute("uv",new Ce(b,2)),z.setIndex(M),this.patchMesh=new Rt(z,this.patchMat),this.patchMesh.renderOrder=1,e.add(this.patchMesh)}applyPalette(t){if(this.lastPal!==t){this.lastPal=t,this.matAisle.color.setHex(t.floorAisle),this.matCarpet.color.setHex(t.floorCarpet),this.matWall.color.setHex(t.wall),this.matSlab.color.setHex(t.slab),b_(this.winTex.ctx,40,26,t),this.winTex.tex.needsUpdate=!0,this.winMat.color.setScalar(t.posterTint);for(const e of this.tints)e.color.setScalar(t.posterTint);this.patchMat.color.setHex(t.windowGlow.color),this.patchMat.opacity=t.windowGlow.opacity}}}const Fa=["#c792ea","#82aaff","#c3e88d","#f78c6c","#ffcb6b","#89ddff"];function A_(i){const t=Jn(i*7919+13),e=[];for(let n=0;n<48;n++){const s=[],r=1+Math.floor(t()*4);for(let a=0;a<r;a++)s.push({len:3+Math.floor(t()*10),c:Math.floor(t()*(Fa.length+2))});e.push({indent:t()<.25?0:t()<.6?2:4,segs:s})}return e}class Vr{constructor(t,e,n){this.w=t,this.h=e,this.c=Vn(t,e),this.mat=new Xt({map:this.c.tex,toneMapped:!1}),this.lines=A_(n)}c;mat;lines;lastKey="";setGain(t){this.mat.color.setScalar(t)}draw(t,e,n,s,r=""){const{ctx:a,tex:o}=this.c,{w:l,h:c}=this;if(t==="off"){if(this.lastKey==="off")return;a.fillStyle="#06070a",a.fillRect(0,0,l,c),a.fillStyle="#12151c",a.fillRect(0,0,l,1),this.lastKey="off",o.needsUpdate=!0;return}if(this.lastKey=t,t==="code"||t==="think"){a.fillStyle="#10141f",a.fillRect(0,0,l,c),a.fillStyle=n,a.fillRect(0,0,l,4),a.fillStyle="rgba(0,0,0,0.35)",a.fillRect(2,1,12,2),a.fillStyle="#1a2133",a.fillRect(0,4,8,c-4);const f=Math.floor((c-5)/3),u=Math.floor(e*(t==="code"?7:1.1));for(let p=0;p<f;p++){const g=this.lines[(p+u)%this.lines.length];let _=10+g.indent;const m=6+p*3;for(const d of g.segs){a.fillStyle=Fa[d.c%Fa.length]??"#aab4d0",d.c>=Fa.length&&(a.fillStyle="#8791b0");const E=Math.min(d.len,l-_-2);if(E>0&&a.fillRect(_,m,E,2),_+=d.len+2,_>l-3)break}a.fillStyle="#3a4560",a.fillRect(2,m,4,2)}Math.floor(e*2)%2===0&&(a.fillStyle="#ffffff",a.fillRect(10+u*5%20,6+(f-1)*3,2,2))}else if(t==="wait"){a.fillStyle="#0d1424",a.fillRect(0,0,l,c),a.fillStyle=n,a.fillRect(0,0,l,4);const f=Math.floor(l/2),h=Math.floor(c/2)-3;for(let u=0;u<8;u++){const p=u/8*Math.PI*2,g=(Math.floor(e*8)-u+80)%8/8,_=Math.floor(70+(1-g)*185);a.fillStyle=`rgb(${_},${_},${Math.min(255,_+20)})`,a.fillRect(Math.round(f+Math.cos(p)*6)-1,Math.round(h+Math.sin(p)*6)-1,2,2)}a.fillStyle="#26324e",a.fillRect(6,c-8,l-12,4),a.fillStyle="#5ad17a",a.fillRect(6,c-8,Math.max(2,Math.floor((l-12)*Math.min(1,s))),4)}else if(t==="help"){const f=Math.floor(e*3)%2===0;a.fillStyle=f?"#2e2606":"#201a04",a.fillRect(0,0,l,c),a.fillStyle="#ffd25a",a.fillRect(0,0,l,4);const h=Math.floor(l/2)-14,u=7;a.fillStyle="#10141f",a.fillRect(h-1,u-1,30,22),a.fillStyle="#ffd25a",a.fillRect(h,u,28,20),a.fillRect(h+6,u+20,4,3),re(a,"?",Math.floor(l/2),u+3,"#10141f",2);for(let p=0;p<3;p++)a.fillStyle=(Math.floor(e*3)+p)%3===0?"#ffd25a":"#5a4a14",a.fillRect(Math.floor(l/2)-7+p*6,c-7,4,4)}else if(t==="blocked"){const f=Math.floor(e*3)%2===0;a.fillStyle=f?"#3a0c12":"#2a080c",a.fillRect(0,0,l,c),a.fillStyle="#e5484d",a.fillRect(0,0,l,4);const h=Math.floor(l/2)-14,u=9;a.fillStyle="#ffeaea",a.fillRect(h,u,28,18),a.fillStyle="#e5484d",a.fillRect(h,u,28,4),a.fillStyle="#e5484d",a.fillRect(h+12,u+7,4,7),a.fillRect(h+12,u+15,4,2),a.fillStyle="#e5484d",a.fillRect(4,c-7,l-8,2),a.fillRect(4,c-4,Math.floor((l-8)*.6),2)}else if(t==="review"){a.fillStyle="#0e1220",a.fillRect(0,0,l,c),a.fillStyle=n,a.fillRect(0,0,l,4);const f=Math.floor((c-5)/3),h=Math.floor(e*1.6);for(let u=0;u<f;u++){const p=this.lines[(u+h)%this.lines.length],g=(u+h)%5;a.fillStyle=g===1||g===2?"rgba(80,220,120,0.35)":g===4?"rgba(235,80,90,0.4)":"rgba(0,0,0,0)",a.fillRect(0,6+u*3-1,l,3),a.fillStyle=g===1||g===2?"#7dffa0":g===4?"#ff7a85":"#6b7596",a.fillRect(3,6+u*3,2,1),a.fillRect(8+p.indent,6+u*3,Math.min(l-12,6+p.segs[0].len*2),2)}}else if(t==="plan"){a.fillStyle="#0f1424",a.fillRect(0,0,l,c),a.fillStyle=n,a.fillRect(0,0,l,4);const f=4,h=Math.floor((l-4)/f);for(let u=0;u<f;u++){a.fillStyle="#26304e",a.fillRect(2+u*h,6,h-1,c-8);const p=2+(u*3+Math.floor(e/3))%4;for(let g=0;g<p;g++)a.fillStyle=["#5ad17a","#f2c94c","#f08a3c","#e5484d"][(u+g)%4],a.fillRect(3+u*h,8+g*4,h-3,3)}}else{a.fillStyle="#080b14",a.fillRect(0,0,l,c);const f=Math.abs(e*6%((l-10)*2)-(l-10)),h=Math.abs(e*4%((c-8)*2)-(c-8));a.fillStyle=n,a.fillRect(Math.floor(f),Math.floor(h),8,5),a.fillStyle="rgba(255,255,255,0.4)",a.fillRect(Math.floor(f)+1,Math.floor(h)+1,3,1),r&&re(a,r,l/2,c-8,"#1d2a44",1)}o.needsUpdate=!0}drawBrowser(t,e,n,s){const{ctx:r,tex:a}=this.c,{w:o,h:l}=this;if(!t){if(this.lastKey==="bdim")return;this.lastKey="bdim",r.fillStyle="#0a0d16",r.fillRect(0,0,o,l),r.fillStyle="#1b2236",r.fillRect(0,0,o,3),a.needsUpdate=!0;return}this.lastKey="bon",r.fillStyle="#e9edf5",r.fillRect(0,0,o,l),r.fillStyle="#c4cbd9",r.fillRect(0,0,o,4),r.fillStyle="#ff6b6b",r.fillRect(1,1,2,2),r.fillStyle="#ffd25a",r.fillRect(4,1,2,2),r.fillStyle="#5ad17a",r.fillRect(7,1,2,2),r.fillStyle="#ffffff",r.fillRect(11,1,o-13,2),r.fillStyle=n,r.fillRect(2,6,o-4,4);const c=Math.floor(e*2)%4;for(let u=0;u<3;u++)r.fillStyle=u===c%3?"#9ec5ff":"#d3d9e6",r.fillRect(2+u*Math.floor((o-2)/3),12,Math.floor((o-2)/3)-2,8);r.fillStyle="#9aa3b8",r.fillRect(2,l-4,o-8,1),r.fillStyle=s?"#2fb85a":"#e5484d";const f=o-9,h=l-8;Math.floor(e*1.5)%2===0&&(r.fillRect(f,h+2,2,2),r.fillRect(f+2,h+4,2,2),r.fillRect(f+4,h,2,4)),a.needsUpdate=!0}}const R_=new Tt(16767392),bh=[8097720,10127032,8301208,12623998],Pn=1.9;function C_(i,t){const{x:e,z:n}=t.center,s=Jn(t.index*131+7),r=bh[t.col%bh.length],a=14474468,o=ci.width,l=ci.depth;i.box(e,.75,n-l/2+.05,o,1.5,.1,r),i.box(e,1.53,n-l/2+.05,o+.08,.06,.16,a);for(const _ of[-1,1]){const m=e+_*(o/2-.05);i.box(m,.65,n-l/2+Pn/2,.1,1.3,Pn,r),i.box(m,1.33,n-l/2+Pn/2,.16,.06,Pn,a);const d=l-Pn;i.box(m,.42,n-l/2+Pn+d/2,.1,.84,d,r),i.box(m,.86,n-l/2+Pn+d/2,.16,.05,d,a),i.box(m,.8,n-l/2+.05,.14,1.6,.14,4868696)}const c=e-o/2+.11;i.box(c,1,n-.75,.03,.55,1.15,12159834);const f=[16769898,16751288,9099519,11071626,16758890];for(let _=0;_<6;_++)i.box(c+.02,.88+s()*.26,n-1.25+_*.17+s()*.05,.015,.12,.12,f[Math.floor(s()*5)],0,(s()-.5)*.4);const h=e+1.15;i.box(h,1.2,n-l/2+.11,.38,.28,.02,16052454),i.box(h,1.2,n-l/2+.122,.3,.2,.01,[5933776,13660250,5945456][t.index%3]),i.box(e,.72,n-.56,3.12,.06,1.5,13673580),i.box(e,.745,n+.18,3.12,.012,.03,15254668),i.box(e-1.5,.36,n-.56,.06,.7,1.4,6965810),i.box(e+1.12,.36,n-.58,.66,.7,1.36,9071176);for(let _=0;_<3;_++)i.box(e+1.12,.17+_*.22,n+.11,.6,.18,.02,10518102),i.box(e+1.12,.21+_*.22,n+.125,.18,.025,.015,14211296);i.box(e-.95,.27,n-.7,.22,.48,.42,2303278),i.box(e-.95,.4,n-.48,.12,.02,.01,5953791),i.box(e+.02,.768,n+.03,.66,.025,.22,2764346),i.box(e+.02,.783,n+.03,.6,.006,.16,4870244),i.box(e+.55,.765,n+.05,.2,.014,.22,3817298),i.box(e+.55,.778,n+.05,.06,.02,.1,15263984),i.box(e+.05,.775,n-.62,.32,.03,.22,2764346),i.box(e+.05,.9,n-.64,.07,.24,.05,2764346),i.box(e+.05,1.17,n-.7,.7,.4,.06,2105900);const u=e-.98,p=n-.7;i.box(u,.775,p,.26,.03,.2,2764346,.5),i.box(u,.88,p,.06,.2,.05,2764346,.5),i.box(e+1.24,.775,n-1.12,.18,.03,.18,2763316),i.box(e+1.24,.95,n-1.12,.03,.34,.03,2763316),i.box(e+1.16,1.11,n-1.12,.14,.03,.03,2763316),$a(i,e+.74,.75,n-1.08,[13652554,15790320,4883152,16765530][t.index%4]);const g=(_,m,d)=>{const E=Math.floor(s()*6);E===0?Ka(i,m,d,.55,t.index*10+_,.75):E===1?m_(i,m,.75,d):E===2?u_(i,m,.75,d):E===3?d_(i,m,.75,d,[15026253,4883152,14251863,5951866][t.index%4],16769208):E===4?p_(i,m,.75,d,t.index*3+_):g_(i,m,.75,d,[9099519,16758922,11071626][t.index%3])};g(0,e+1.25,n-.2),g(1,e-1.4,n+0),i.box(e+1.5,.16,n+.85,.24,.32,.24,4869726),i.box(e+1.5,.33,n+.85,.2,.02,.2,1710626)}class P_{constructor(t,e){this.d=t,this.sh=e;const{x:n,z:s}=t.center;this.main=new Vr(64,40,t.index+1),this.side=new Vr(40,26,t.index+50);const r=new Rt(new Te(.9,.52),this.main.mat);r.position.set(n+.05,1.19,s-.62+.036),this.group.add(r);const a=new kt;a.position.set(n-.98,0,s-.7),a.rotation.y=.55;const o=new Rt(new Te(.54,.34),this.side.mat);o.position.set(0,1.04,.03),a.add(o);const l=new Rt(new Ie(.62,.42,.05),e.lam.off);l.position.set(0,1.04,0),l.castShadow=!0,a.add(l),this.group.add(a);const c=new Rt(new Ie(1,.6,.07),e.lam.off);c.position.set(n+.05,1.18,s-.62),c.castShadow=!0,this.group.add(c);const f=new be,h=ci.width,u=ci.depth;f.box(n,1.575,s-u/2+.05,h+.1,.03,.18,16777215);for(const O of[-1,1]){const T=n+O*(h/2-.05);f.box(T,1.375,s-u/2+Pn/2,.18,.03,Pn+.02,16777215),f.box(T,.885,s-u/2+Pn+(u-Pn)/2,.18,.03,u-Pn,16777215)}const p=Fe(f,e.lam.off,!1,!1);this.group.add(p);const g=new Rt(new Ie(.2,.09,.2),e.lampOn.off);g.position.set(n+1.12,1.1,s-1.12),g.rotation.z=.25,this.group.add(g);const _=new be;_.box(0,.04,0,.56,.04,.07,2763316).box(0,.04,0,.07,.04,.56,2763316).box(0,.045,0,.4,.04,.4,2763316,Math.PI/4),_.box(0,.14,0,.07,.2,.07,3816006);for(const[O,T]of[[.26,0],[-.26,0],[0,.26],[0,-.26]])_.box(O,.015,T,.07,.03,.07,1381658);this.chair.add(Fe(_,e.vc));const m=new be;m.box(0,.255,.03,.54,.09,.64,16777215),m.box(0,.58,.42,.5,.5,.07,16777215),m.box(.29,.42,.08,.05,.03,.34,3355456),m.box(-.29,.42,.08,.05,.03,.34,3355456),m.box(.29,.35,.2,.04,.14,.04,3355456),m.box(-.29,.35,.2,.04,.14,.04,3355456);const d=Fe(m,e.lam.off);this.chair.add(d),this.chairZ=s+.55,this.chair.position.set(n,0,s-.1),this.group.add(this.chair),this.glowMat=new Xt({map:os(),color:16777215,transparent:!0,opacity:0,blending:$n,depthWrite:!1,toneMapped:!1}),this.glow=new Rt(new Te(4.4,3.8),this.glowMat),this.glow.rotation.x=-Math.PI/2,this.glow.position.set(n+.3,.07,s+.1),this.glow.renderOrder=2,this.group.add(this.glow),this.cardTex=Vn(56,24,!0);const E=new Xt({map:this.cardTex.tex,toneMapped:!1}),y=new Li({color:16051416});this.tent=new Rt(new Ie(.46,.2,.02),[y,y,y,y,E,y]),this.tent.position.set(n-.55,.86,s+.08),this.tent.rotation.x=-.3,this.group.add(this.tent);const S=new be;bf(S,0,.75,0,7,t.index+3,16183779,.26,.34),this.paper=Fe(S,e.vc),this.paper.position.set(n+.9,0,s-.15),this.paper.rotation.y=.2,this.paper.visible=!1,this.group.add(this.paper),this.parts={bezelMain:c,bezelSide:l,trim:p,shade:g,cushions:d},this.main.draw("off",0,"#000",0),this.side.drawBrowser(!1,0,"#000",!0),this.setLook("off")}group=new kt;chair=new kt;main;side;parts;glowMat;glow;cardTex;cardKey="";paper;tent;occupied=!1;acc=Math.random();glowCur=0;chairZ;kind="off";screenMode="";setLook(t){if(t===this.kind)return;this.kind=t;const e=this.sh;this.parts.bezelMain.material=e.lam[t],this.parts.bezelSide.material=e.lam[t],this.parts.trim.material=t==="off"?e.lam.off:e.lam[t],this.parts.shade.material=e.lampOn[t],this.parts.cushions.material=e.lam[t]}drawCard(t,e,n){const s=t+"|"+e+"|"+n;if(s===this.cardKey)return;this.cardKey=s;const{ctx:r,tex:a}=this.cardTex;r.fillStyle="#f4ecd8",r.fillRect(0,0,56,24),r.fillStyle=n,r.fillRect(0,0,56,3),r.fillRect(0,0,3,24),r.fillStyle="#1e2030";const o=t.length>8?t.slice(0,8):t;ne(r,o,28-un(o)/2+1,6,"#1e2030",1);const l=("@"+e).slice(0,9);ne(r,l,28-un(l)/2+1,15,"#6a6a7a",1),a.needsUpdate=!0}update(t,e,n,s,r){const a=!!t;this.occupied=a;const o=!a||t.phase==="offline"||t.pose==="sleep",l=a?t.provider:"off";this.setLook(l);const c=l==="off"?"#556":"#"+Cl[l].toString(16).padStart(6,"0"),f=a?this.chairZ:this.d.center.z-.1;this.chair.position.z+=(f-this.chair.position.z)*(1-Math.exp(-5*n)),this.chair.rotation.y=a?0:.12*(this.d.index%3-1),a?this.drawCard(t.name,t.owner,t.ownerColor??"#888888"):this.drawCard("VACANT","","#8a8aa0"),this.tent.position.y=.86;const h=!a||o?0:1;this.glowCur+=(h-this.glowCur)*(1-Math.exp(-3*n));const u=r?1:.94+.06*Math.sin(e*5+this.d.index);this.glowMat.opacity=this.glowCur*s.lampStrength*.55*u,l!=="off"&&this.glowMat.color.setHex(Cl[l]).lerp(R_,.55),this.parts.shade.material=o?this.sh.lampOn.off:this.sh.lampOn[l],this.paper.visible=!!t&&!!t.ticketId&&!t.carrying&&["working","waiting","blocked","reworking","awaiting_review","asking_help","awaiting_help","helping"].includes(t.phase),this.acc+=n;const p=r?.4:.16;if(this.acc<p)return;this.acc=0;const g=s.screenGain;this.main.setGain(g),this.side.setGain(g);let _="off";if(a&&!o){const d=t;d.pose==="blocked"||d.phase==="blocked"?_="blocked":d.phase==="asking_help"||d.pose==="raise_hand"?_="help":d.pose==="type"||d.phase==="working"||d.phase==="reworking"||d.phase==="helping"?_="code":d.pose==="think"?_="think":d.pose==="wait"||d.phase==="waiting"||d.phase==="awaiting_review"||d.phase==="awaiting_help"?_="wait":d.pose==="review"?_="review":_="idle"}else a&&(_="idle");this.screenMode=_,this.main.draw(_,e,t&&t.phase==="awaiting_help"?"#ffd25a":c,t?t.phaseProgress:0,a&&o?"ZZZ":"");const m=_==="code"||_==="think"||_==="review";this.side.drawBrowser(m,e,c,!(t&&t.phase==="reworking"))}get mode(){return this.screenMode}}class L_{group=new kt;desks=[];constructor(t){const e=new be;for(const n of Il){C_(e,n);const s=new P_(n,t);this.desks.push(s),this.group.add(s.group)}this.group.add(Fe(e,t.vc))}update(t,e,n,s,r){for(const a of this.desks){const o=t.find(l=>l.role==="worker"&&l.deskIndex===a.d.index)??null;a.update(o,e,n,s,r)}}}const D_="#9aa4c0";class Jl{map=new Map;sig="";fn=t=>this.map.get(t)??{id:t,name:t,color:D_,glyph:(t.slice(0,2)||"??").toUpperCase(),category:"quality"};sync(t){const e=t??[];let n=String(e.length);for(let s=0;s<e.length;s++)n+="|"+e[s].id+e[s].color+e[s].glyph+(e[s].custom?"c":"");if(n!==this.sig){this.sig=n,this.map.clear();for(const s of e)this.map.set(s.id,s)}}}function mi(i,t,e,n,s,r,a=1){const{tex:o,aspect:l}=Tf(t,e,n,s,a),c=new Xt({map:o,toneMapped:!1});return i.tint(c),new Rt(new Te(r*l,r),c)}class Pl{meshes=[];s=[];v=[];constructor(t,e,n,s){e.forEach((r,a)=>{const o=new Rt(n[a%n.length],s);o.position.set(...r),o.castShadow=!0,o.receiveShadow=!0,o.scale.setScalar(1e-4),t.add(o),this.meshes.push(o),this.s.push(0),this.v.push(0)})}kick(t,e=5){t>=0&&t<this.v.length&&(this.v[t]+=e)}update(t,e){for(let n=0;n<this.meshes.length;n++){const s=n<t?1:0;this.v[n]+=(s-this.s[n])*160*e,this.v[n]*=Math.exp(-11*e),this.s[n]=Math.max(0,this.s[n]+this.v[n]*e);const r=this.meshes[n];r.visible=this.s[n]>.01||s===1,r.scale.setScalar(Math.max(1e-4,this.s[n]))}}}function Ll(i,t,e,n,s,r,a){const o=[];for(let l=0;l<i;l++){const c=new be;bf(c,0,0,0,t+l%3,a+l,s,e,n,r),o.push(c.build())}return o}class I_{group=new kt;slots;constructor(t){const e=new be,n=We.depot.prop.x,s=12094040,r=6965808;for(const h of[n-2.15,n,n+2.15])e.box(h,1.35,-10.55,.1,2.7,.8,r);for(const h of[.3,1.1,1.9,2.7])e.box(n,h,-10.55,4.4,.08,.8,s);e.box(n,1.4,-10.93,4.3,2.6,.04,5914152);let a=5;for(const h of[.34,1.14,1.94])M_(e,n-2.05,h,-10.7,-10.4,a++);const o=Jn(77);for(const h of[.34,1.14,1.94])for(let u=0;u<6;u++){const p=n-2+u*.7+o()*.1;o()<.25||(e.box(p,h+.2,-10.58,.5,.36,.5,[13215346,14203018,12095582][u%3]),e.box(p,h+.26,-10.32,.34,.12,.02,16052454))}e.box(n,.47,-8.9,4.4,.94,.95,9069120),e.box(n,.97,-8.9,4.6,.07,1.05,14200952),e.box(n,.45,-8.4,4.2,.8,.04,10516552);for(let h=0;h<7;h++)e.box(n-1.8+h*.6,.45,-8.38,.5,.7,.02,8016948);this.group.add(Fe(e,t.sh.vc));const l=mi(t,"TICKETS","#2a3a6a","#ffe9a8","#ffd25a",.55,2);l.position.set(n,3.05,-10.94),this.group.add(l);const c=mi(t,"TAKE ONE","#f4ecd8","#2a2a3a","#8a6a48",.17,1);c.position.set(n,.55,-8.36),this.group.add(c);const f=[];for(let h=0;h<2;h++)for(let u=0;u<7;u++)f.push([n-1.74+u*.58+(h?.1:0),1.005,h?-8.62:-9.2]);this.slots=new Pl(this.group,f,Ll(5,5,.3,.36,16183779,4878288,40),t.sh.vc)}update(t){this.slots.update(Math.max(0,Math.min(14,t.state.depotStacks??0)),t.dt)}}const Do=15,wa=30;class Ga{group=new kt;bayB=new kt;bayBs=0;bayBv=0;carts=[];lampGlow;lampMat;catMats=new Map;ctx;countCv=Vn(72,13,!1);countSig="";haloMat;idx=new Jl;static bayGeo(t,e,n,s){const o=-13.45-n,l=e-2.5,c=[1.25,2.15,3.05];t.box(s-.05-n,1.7,e,.1,3.4,5.2,4861986);for(let f=0;f<=5;f++)t.box(o,1.7,l+f*1,.95,3.4,.1,5913640);t.box(o,.19,e,1,.38,5.1,6964784);for(let f=0;f<5;f++)t.box(-12.94-n,.19,l+.5+f,.02,.28,.82,8279608),t.box(-12.92-n,.19,l+.5+f,.02,.05,.2,14205040);for(const f of[.4,...c])t.box(o,f-.05,e,1,.1,5.1,10119748);t.box(o,3.2,e,1.05,.12,5.3,5913640),t.box(o,3.42,e,.5,.05,5.4,9082532);for(const f of c)for(let h=0;h<5;h++){const u=l+.5+h;for(const[p,g,_,m]of[[0,-.37,.56,.03],[0,.37,.56,.03],[-.27,0,.03,.74],[.27,0,.03,.74]])t.box(-13.2-n+p,f+.005,u+g,_,.01,m,3811876)}}constructor(t){this.ctx=t;const e=We.library.prop.z,n=-5,s=-13.95,r=new be;Ga.bayGeo(r,e,0,-13.89);const a=e+3;for(const d of[-.25,.25])r.box(-13.45,1.7,a+d,.07,3.5,.07,13213802,0,0,.1);for(let d=0;d<8;d++)r.box(-13.45-.1*(.3+d*.4)+.2,.3+d*.4,a,.05,.05,.5,13213802);const o=e+3.9;r.box(-13.1,.03,o,.34,.06,.34,2763316),r.box(-13.1,.85,o,.05,1.7,.05,2763316),r.box(-12.4,.2,o+.1,.45,.4,.45,9062986),r.box(-12.4,.42,o+.1,.5,.06,.5,12081754),this.group.add(Fe(r,t.sh.vc)),this.lampGlow=new Xt({color:16769184,toneMapped:!1});const l=new Rt(new Ie(.4,.28,.4),this.lampGlow);l.position.set(-13.1,1.75,o),this.group.add(l),this.lampMat=new Xt({map:os(),color:16760944,transparent:!0,opacity:.4,blending:$n,depthWrite:!1,toneMapped:!1});const c=new Rt(new Te(3.6,3.6),this.lampMat);c.rotation.x=-Math.PI/2,c.position.set(-12.6,.075,o+.2),this.group.add(c);const f=new be;Ga.bayGeo(f,n,s,-13.79),this.bayB.position.set(s,0,0),this.bayB.add(Fe(f,t.sh.vc)),this.bayB.visible=!1,this.bayB.scale.set(1e-4,1,1),this.group.add(this.bayB);const h=mi(t,"SKILL LIBRARY","#1f2a4a","#9be8ff","#38bdf8",.62,2);h.rotation.y=Math.PI/2,h.position.set(-13.93,4.12,e),this.group.add(h);const u=mi(t,"LOAD SKILLS BEFORE CODING","#f4ecd8","#3a2a1e","#8a6a48",.2,1);u.rotation.y=Math.PI/2,u.position.set(-13.92,3.62,e-1.55),this.group.add(u);const p=mi(t,"SKILL LIBRARY II","#1f2a4a","#9be8ff","#38bdf8",.4,1.4);p.rotation.y=Math.PI/2,p.position.set(-13.93-s,3.95,n),this.bayB.add(p);const g=new Xt({map:this.countCv.tex,toneMapped:!1});t.tint(g);const _=new Rt(new Te(1.1,1.1*13/72),g);_.rotation.y=Math.PI/2,_.position.set(-13.92,3.62,e+1.85),this.group.add(_),this.drawCount(0,0),this.haloMat=new Xt({map:os(),color:16765530,transparent:!0,opacity:.55,blending:$n,depthWrite:!1,toneMapped:!1});const m=[1.25,2.15,3.05];for(let d=0;d<wa;d++){const E=d>=Do,y=d%Do,S=E?n:e,O=S-2.5,T=Math.floor(y/5),R=y%5,I=m[T],b=O+.5+R,M=E?this.bayB:this.group,A=E?s:0,V=new kt;V.position.set(-13.2-A,I,b);const z=new Rt(new Ge,t.sh.vc);z.castShadow=!0,z.receiveShadow=!0,V.add(z);const C=Vn(26,16,!0),W=new Xt({map:C.tex,toneMapped:!1}),G=new Rt(new Te(.62,.38),W);G.rotation.y=Math.PI/2,G.position.set(.295,.36,0),V.add(G);const Z=new Rt(new Te(.72,.17),this.catMat("QUALITY"));Z.rotation.y=Math.PI/2,Z.position.set(-12.945-A,I-.06,b),Z.visible=!1,M.add(Z),V.scale.setScalar(1e-4),V.visible=!1,M.add(V),this.carts.push({group:V,body:z,plate:G,plateMat:W,plateCv:C,halo:null,cat:Z,s:0,v:0,sig:"",custom:!1,y:I,z:b,parent:M})}}catMat(t){let e=this.catMats.get(t);if(!e){const n=Tf(t.toUpperCase(),"#f4ecd8","#2a2030","#8a6a48",1,2,1);e=new Xt({map:n.tex,toneMapped:!1}),this.ctx.tint(e),this.catMats.set(t,e)}return e}drawCount(t,e){const{ctx:n,tex:s}=this.countCv;n.fillStyle="#8a6a48",n.fillRect(0,0,72,13),n.fillStyle="#f4ecd8",n.fillRect(1,1,70,11),re(n,t+(t===1?" SKILL":" SKILLS")+(e>0?" +"+e:""),36,3,"#2a2030",1),s.needsUpdate=!0}assign(t,e){if(t.body.geometry.dispose(),!e){t.body.geometry=new Ge,t.cat.visible=!1,t.custom=!1,t.halo&&(t.halo.visible=!1);return}const n=new Tt(e.color||"#9aa4c0"),s=n.getHex(),r=new be;r.box(0,.31,0,.58,.62,.74,s),r.box(0,.64,0,.5,.05,.66,Ef(s,.78)),r.box(.05,.1,0,.5,.1,.5,2763316,0,0,0),r.box(-.1,.66,0,.3,.04,.4,1381660),e.custom&&(r.box(0,.7,0,.12,.1,.12,16765530),r.box(0,.74,0,.05,.07,.05,16777215)),t.body.geometry=r.build();const{ctx:a,tex:o}=t.plateCv;a.fillStyle=e.custom?"#ffd25a":"#10141f",a.fillRect(0,0,26,16),e.custom&&(a.fillStyle="#10141f",a.fillRect(1,1,24,14)),a.fillStyle=e.color||"#9aa4c0",a.fillRect(e.custom?2:1,e.custom?2:1,e.custom?22:24,e.custom?12:14),a.fillStyle="rgba(255,255,255,0.35)",a.fillRect(1,1,24,2);const l=(e.glyph||e.name.slice(0,2)||"??").toUpperCase(),c=l.length>2?1:2,h=n.r*.3+n.g*.59+n.b*.11>.45?"#10141f":"#ffffff";if(re(a,l,13,c===2?2:5,h,c),e.custom){a.fillStyle="#ffffff";for(const[u,p]of[[4,3],[3,4],[4,4],[5,4],[2,5],[3,5],[4,5],[5,5],[6,5],[3,6],[5,6]])a.fillRect(u,p,1,1);a.fillStyle="#ffd25a",a.fillRect(4,5,1,1)}o.needsUpdate=!0,t.cat.material=this.catMat(e.category||"quality"),t.cat.visible=!0,t.custom=!!e.custom,e.custom?(t.halo||(t.halo=new Rt(new Te(1.1,1.1),this.haloMat),t.halo.rotation.y=Math.PI/2,t.halo.position.set(.33,.4,0),t.halo.renderOrder=2,t.group.add(t.halo)),t.halo.visible=!0):t.halo&&(t.halo.visible=!1)}update(t){const e=t.state.skills&&t.state.skills.length?t.state.skills:Cf;this.idx.sync(e);const n=t.state.libraryStock?new Set(t.state.libraryStock):null,s=Math.min(wa,e.length);for(let l=0;l<this.carts.length;l++){const c=this.carts[l],f=l<s?e[l]:null,h=f?f.id+f.color+f.glyph+(f.custom?"c":""):"";let u=0;h!==c.sig?c.s<.03&&(this.assign(c,f),c.sig=h,u=f&&(!n||n.has(f.id))?1:0):u=f&&(!n||n.has(f.id))?1:0,c.v+=(u-c.s)*150*t.dt,c.v*=Math.exp(-10*t.dt),c.s=Math.max(0,c.s+c.v*t.dt),c.group.visible=c.s>.01,c.group.scale.setScalar(Math.max(1e-4,c.s)),c.halo&&c.halo.visible&&c.halo.scale.setScalar(.85+(t.reduced?.1:.15*Math.sin(t.t*3+l)))}const r=s>Do?1:0;this.bayBv+=(r-this.bayBs)*90*t.dt,this.bayBv*=Math.exp(-9*t.dt),this.bayBs=Math.max(0,this.bayBs+this.bayBv*t.dt),this.bayB.visible=this.bayBs>.01,this.bayB.scale.set(Math.max(1e-4,this.bayBs),1,1);const a=s+"/"+Math.max(0,e.length-wa);a!==this.countSig&&(this.countSig=a,this.drawCount(s,Math.max(0,e.length-wa)));const o=t.reduced?1:.9+.1*Math.sin(t.t*2.1);this.lampGlow.color.setRGB(1*o,.82*o,.55*o),this.lampMat.opacity=.42*t.pal.lampStrength*o}}class U_{group=new kt;led;glow;strip;constructor(t){const e=new be,n=We.vault.prop.x,s=-9.55;e.box(n,1,s-.65,1.9,2,1.3,4872296),e.box(n,2.02,s-.65,2,.08,1.4,6649480),e.box(n,.06,s-.65,2,.12,1.4,2765374),e.box(n,1,s+.025,1.62,1.68,.06,7702427),e.box(n,1,s+.06,1.46,1.52,.03,6715790);const r=n-.28;e.box(r,1,s+.12,.54,.07,.06,14211296).box(r,1,s+.12,.07,.54,.06,14211296),e.box(r,1,s+.12,.4,.07,.06,14211296,0,0,Math.PI/4).box(r,1,s+.12,.4,.07,.06,14211296,0,0,-Math.PI/4),e.box(r,1,s+.15,.16,.16,.08,16765530),e.box(n+.5,1.05,s+.1,.36,.56,.05,1974828);for(let f=0;f<4;f++)for(let h=0;h<3;h++)e.box(n+.4+h*.1,.9+f*.1,s+.14,.07,.07,.02,(f+h)%2?12634328:10134712);for(const f of[.45,1.55])e.box(n-.86,f,s+.03,.06,.2,.08,2765374);e.box(n+1.25,.2,s-.2,.4,.4,.5,3816008),e.box(n+1.25,.42,s-.2,.2,.04,.3,16765530),this.group.add(Fe(e,t.sh.vc)),this.led=new Xt({color:15026253,toneMapped:!1});const a=new Rt(new Ie(.28,.06,.03),this.led);a.position.set(n+.5,1.28,s+.14),this.group.add(a),this.strip=new Xt({color:3866560,toneMapped:!1,transparent:!0,opacity:.8});const o=new Rt(new Ie(1.5,.05,.02),this.strip);o.position.set(n,1.86,s+.085),this.group.add(o);const l=mi(t,"SECRETS","#1a1a24","#ff8a8a","#e5484d",.4,2);l.position.set(n,2.45,s-0),this.group.add(l),this.glow=new Xt({map:os(),color:3866560,transparent:!0,opacity:.15,blending:$n,depthWrite:!1,toneMapped:!1});const c=new Rt(new Te(4,3),this.glow);c.rotation.x=-Math.PI/2,c.position.set(n,.075,s+.9),this.group.add(c)}update(t){const e=t.state.agents.some(r=>r.phase==="blocked"),n=Math.floor(t.t*(e?4:1))%2===0;this.led.color.setHex(e?n?16730698:5246992:n?3866490:1333802);const s=t.reduced?.7:.7+.3*Math.sin(t.t*1.6);this.glow.opacity=.22*s*(.6+t.pal.lampStrength*.6),this.strip.opacity=.5+.4*s}}const Io=[{key:"backlog",label:"BACKLOG",color:"#9aa4c0"},{key:"doing",label:"IN PROGRESS",color:"#ffd25a"},{key:"review",label:"IN REVIEW",color:"#c792ea"},{key:"merged",label:"MERGED",color:"#5ad17a"}];function N_(i){switch(i.status){case"backlog":case"assigned":return 0;case"in_progress":case"changes_requested":return 1;case"in_review":return 2;default:return 3}}function F_(i){return"$"+(i>=100?i.toFixed(0):i>=10?i.toFixed(1):i.toFixed(2))}function O_(i){return"$"+(i>=100||i>=10?i.toFixed(0):i.toFixed(1))}class B_{group=new kt;c=Vn(384,144,!0);sig="";acc=0;skills=new Jl;skillFn=this.skills.fn;mat;live=!1;constructor(t){const e=new be,n=We.board.prop.x;e.box(n,2.9,-10.9,9.5,3.7,.14,6965296),e.box(n,2.9,-10.82,9.2,3.45,.04,2763320),e.box(n,1.02,-10.7,9.6,.1,.45,5913638);for(let r=0;r<6;r++)e.box(n-3+r*.35,1.1,-10.62,.22,.04,.05,[15026253,4883152,3092282,4175984,16765530,15235577][r]);for(const r of[-1,1])for(const a of[-1,1])e.box(n+r*4.5,2.9+a*1.65,-10.76,.12,.12,.06,15026253);this.group.add(Fe(e,t.sh.vc,!1,!1)),this.mat=new Xt({map:this.c.tex,toneMapped:!1}),t.tint(this.mat);const s=new Rt(new Te(9,3.375),this.mat);s.position.set(n,2.9,-10.79),this.group.add(s),this.draw(null,0)}draw(t,e){const{ctx:n,tex:s}=this.c,r=384,a=144;if(n.fillStyle="#1c2236",n.fillRect(0,0,r,a),n.fillStyle="#262e4a",n.fillRect(0,0,r,29),n.fillStyle="#d97757",n.fillRect(0,0,8,29),n.fillStyle="#2dd4bf",n.fillRect(8,0,4,29),!t){ne(n,"PLAN BOARD",18,8,"#ffffff",2),s.needsUpdate=!0;return}const o=(t.plan?.name??"PLAN").toUpperCase(),l=this.live?Math.max(4,Math.floor((r-26-18-un("DONE "+(t.metrics?.merged??0)+"/"+t.tickets.length,2))/12)):24;ne(n,o.length>l?o.slice(0,l):o,18,4,"#ffffff",2);const c=(t.plan?.note??"").toUpperCase(),f=240;if(un(c)<=f)ne(n,c,18,20,"#9fb0e0",1);else{n.save(),n.beginPath(),n.rect(18,19,f,9),n.clip();const g=un(c)+40,_=Math.floor(e*14)%g;ne(n,c,18-_,20,"#9fb0e0",1),ne(n,c,18-_+g,20,"#9fb0e0",1),n.restore()}const h=t.metrics;if(this.live){const g="DONE "+(h?.merged??0)+"/"+t.tickets.length;ne(n,g,r-8-un(g,2),7,"#5ad17a",2)}else{const g="SPEND "+F_(h?.totalCostUsd??0);ne(n,g,r-8-un(g,1)-0,5,"#ffd25a",1);const _=Math.max(0,Math.min(1,(h?.budgetUsedPct??0)/100)),m=r-128,d=16;n.fillStyle="#10142a",n.fillRect(m,d,120,8);const E=_>.9?"#e5484d":_>.7?"#f08a3c":"#5ad17a";n.fillStyle=E,n.fillRect(m+1,d+1,Math.max(0,Math.round(118*_)),6),n.fillStyle="#ffffff";for(let S=1;S<4;S++)n.fillRect(m+S*30,d,1,2);const y=h&&h.budgetUsedPct>0?"BUDGET "+Math.round(h.budgetUsedPct)+"%":"NO BUDGET";ne(n,y,m,25,"#7f8ab0",1)}const u=94,p=[[],[],[],[]];for(const g of t.tickets)p[N_(g)].push(g);p[0].sort((g,_)=>g.createdAt-_.createdAt),p[3].sort((g,_)=>(_.mergedAt??0)-(g.mergedAt??0));for(let g=0;g<4;g++){const _=2+g*(u+1);n.fillStyle="#232b45",n.fillRect(_,31,u-1,a-32),n.fillStyle=Io[g].color,n.fillRect(_,31,u-1,2),ne(n,this.live&&g===3?"DONE":Io[g].label,_+3,36,Io[g].color,1);const m=String(p[g].length);ne(n,m,_+u-4-un(m),36,"#ffffff",1);const d=p[g],E=2,y=9,S=Math.min(d.length,E*y);for(let O=0;O<S;O++){const T=d[O],R=_+2+O%E*46,I=46+Math.floor(O/E)*10,b=f_[Math.max(0,Math.min(4,(T.difficulty??1)-1))];n.fillStyle="#0c1020",n.fillRect(R,I,44,9),n.fillStyle=b,n.fillRect(R+1,I+1,42,7),T.status==="changes_requested"&&(n.fillStyle="#e5484d",n.fillRect(R,I,44,1),n.fillRect(R,I+8,44,1)),T.status==="in_progress"&&(n.fillStyle="rgba(0,0,0,0.35)",n.fillRect(R+1,I+6,Math.round(42*(1-(T.progress??0))),2));const M=this.live?T.id:O_(T.usage?.costUsd??0);ne(n,M.length>6?M.slice(0,6):M,R+3,I+1,"#10141f",1);let A=R+44-4;const V=(T.skills??[]).slice(0,3);for(let z=V.length-1;z>=0;z--)n.fillStyle="#10141f",n.fillRect(A-3,I+2,4,5),n.fillStyle=this.skillFn(V[z]).color,n.fillRect(A-2,I+3,2,3),A-=4}d.length>S&&ne(n,"+"+(d.length-S)+" MORE",_+3,a-9,"#9aa4c0",1)}s.needsUpdate=!0}update(t){if(this.acc+=t.dt,this.acc<.4)return;this.acc=0;const e=t.state;this.skills.sync(e.skills),this.live=!!t.live;let n=(this.live?"L":"")+this.skills.sig+(e.plan?.name??"")+"|"+(e.metrics?.totalCostUsd??0).toFixed(2)+"|"+(e.metrics?.budgetUsedPct??0).toFixed(2)+"|"+((e.plan?.note??"").length>40?Math.floor(t.t*14):e.plan?.note);for(const s of e.tickets)n+=s.id+s.status+(s.usage?.costUsd??0).toFixed(1)+Math.round((s.progress??0)*8);n!==this.sig&&(this.sig=n,this.draw(e,t.t))}}class z_{group=new kt;screens;chair;acc=0;sh;constructor(t){this.sh=t.sh;const e=new be,n=We.orchSeat.prop.x,s=We.orchSeat.prop.z;e.box(n,.72,s-.06,3.2,.07,1.4,4869738),e.box(n,.755,s+.63,3.2,.015,.03,6975381),e.box(n-1.5,.36,s-.06,.08,.72,1.3,3027270),e.box(n+1.5,.36,s-.06,.08,.72,1.3,3027270),e.box(n,.45,s-.62,3,.6,.04,3027270),e.box(n,.768,s+.45,.7,.025,.22,2764346),e.box(n,.783,s+.45,.62,.006,.16,4870244);for(const c of[-.62,.62])e.box(n+c,.775,s-.2,.3,.03,.2,2764346),e.box(n+c,.9,s-.22,.07,.25,.05,2764346),e.box(n+c,1.2,s-.28,.7,.42,.06,1974314);e.box(n-1.2,.8,s+.3,.2,.04,.04,2763316).box(n-1.3,.77,s+.3,.06,.1,.12,2763316).box(n-1.1,.77,s+.3,.06,.1,.12,2763316),e.box(n-1.3,.76,s+.39,.02,.05,.1,14251863),e.box(n+1.15,.9,s-.35,.34,.46,.03,8015920,0,-.3),e.box(n+1.15,.9,s-.33,.28,.38,.015,16183779,0,-.3);for(let c=0;c<4;c++)e.box(n+1.15,.9+c*.07-.05,s-.32,.2,.012,.01,4878288,0,-.3);$a(e,n+1.25,.75,s+.4,13652554),Ka(e,n-1.3,s-.3,.6,3,.75),__(e,n+1.4,.75,s-.05);for(let c=0;c<3;c++)e.box(n-.3+c*.3,.76,s+.58,.1,.01,.1,[16769898,16751288,9099519][c],c*.3);this.group.add(Fe(e,t.sh.vc)),this.screens=[new Vr(64,40,101),new Vr(64,40,102)],[-.62,.62].forEach((c,f)=>{const h=new Rt(new Te(.62,.36),this.screens[f].mat);h.position.set(n+c,1.2,s-.28+.034),this.group.add(h)});const r=new be,a=We.orchSeat.stand.z;r.box(n,.04,a,.56,.04,.07,2763316).box(n,.04,a,.07,.04,.56,2763316).box(n,.14,a,.07,.2,.07,3816006),this.group.add(Fe(r,t.sh.vc));const o=new be;o.box(n,.255,a+.03,.54,.09,.64,16777215).box(n,.58,a+.42,.5,.5,.07,16777215),this.chair=Fe(o,t.sh.lam.claude),this.group.add(this.chair);const l=new be;for(let c=0;c<7;c++)l.box(n,.03,s-2+c*.7+.35,6.6-c%2*0,.03,.62,c%2?14254938:15654064);l.box(n,.026,s+.35,6.9,.02,4.9,3811914),this.group.add(Fe(l,t.sh.vc,!1,!0))}update(t){const e=t.state.agents.find(s=>s.role==="orchestrator");if(e&&(this.chair.material=this.sh.lam[e.provider]),this.acc+=t.dt,this.acc<.2)return;this.acc=0;const n=!e||e.phase==="offline";this.screens[0].setGain(t.pal.screenGain),this.screens[1].setGain(t.pal.screenGain),this.screens[0].draw(n?"off":"plan",t.t,"#d97757",0),this.screens[1].draw(n?"off":e.pose==="type"?"code":"think",t.t,"#d97757",0)}}class k_{group=new kt;inbox;out;screen;acc=0;constructor(t){const e=new be,n=9.05;e.box(n-.16,.72,-7,1.3,.07,3.5,5917242),e.box(n-.16,.755,-7,1.3,.012,3.5,7232584),e.box(n+.4,.36,-8.65,.08,.7,.2,3812900),e.box(n+.4,.36,-5.35,.08,.7,.2,3812900),e.box(n-.3,.4,-7,.04,.6,3.3,3812900),e.box(n-.1,.775,-7,.2,.03,.3,2764346),e.box(n-.12,.9,-7,.05,.25,.07,2764346),e.box(n-.2,1.2,-7,.06,.45,.82,1974314),e.box(n+.35,.768,-7,.22,.025,.62,2764346),e.box(n+.35,.783,-7,.16,.006,.56,4870244),e.box(n+.3,.78,-7.85,.26,.03,.2,5904922).box(n+.3,.8,-7.85,.2,.01,.14,13645882),e.box(n+.3,.83,-7.5,.1,.06,.1,8015920).box(n+.3,.9,-7.5,.07,.1,.07,4860442).box(n+.3,.97,-7.5,.1,.03,.1,2759184),$a(e,n+.35,.755,-6.2,15790320),Ka(e,n-.2,-8.3,.5,11,.755);for(const l of[-6,-8]){e.box(n-.45,.8,l,.64,.06,1,2763316);for(const c of[-1,1])e.box(n-.45,.86,l+c*.5,.64,.14,.04,l>-7?3828400:11549242);e.box(n-.14,.86,l,.04,.14,1,l>-7?3828400:11549242),e.box(n-.76,.86,l,.04,.14,1,l>-7?3828400:11549242)}const s=We.integSeat.stand.x,r=We.integSeat.stand.z;e.box(s,.04,r,.07,.04,.56,2763316).box(s,.04,r,.56,.04,.07,2763316).box(s,.14,r,.07,.2,.07,3816006),e.box(s-.03,.255,r,.64,.09,.54,6970040).box(s+.42,.58,r,.07,.5,.5,6970040),this.group.add(Fe(e,t.sh.vc)),this.screen=new Vr(64,40,140);const a=new Rt(new Te(.76,.38),this.screen.mat);a.rotation.y=Math.PI/2,a.position.set(n-.2+.034,1.2,-7),this.group.add(a);for(const[l,c,f,h]of[[-6,"INBOX","#2a4a8a","#cfe0ff"],[-8,"OUT","#8a2a2a","#ffd0d0"]]){const u=mi(t,c,f,h,"#f4ecd8",.2,1);u.position.set(n-.3,1.25,l-.6),u.rotation.y=Math.PI/4,this.group.add(u),new Rt(new Ie(.03,.4,.03),t.sh.vc)}const o=l=>{const c=[];for(let f=0;f<2;f++)for(let h=0;h<3;h++)c.push([n-.58+f*.27,.83,l-.31+h*.31]);return c};this.inbox=new Pl(this.group,o(-6),Ll(4,6,.22,.27,16183779,4878288,60),t.sh.vc),this.out=new Pl(this.group,o(-8),Ll(4,6,.22,.27,15972014,13645882,80),t.sh.vc)}bumpInbox(){const t=Math.min(6,this.inboxCount)-1;this.inbox.kick(t,7),this.inbox.kick(t-1,3.5),t<0&&this.inbox.kick(0,4)}inboxCount=0;update(t){if(this.inboxCount=t.state.inboxStacks??0,this.inbox.update(Math.min(6,t.state.inboxStacks??0),t.dt),this.out.update(Math.min(6,t.state.outStacks??0),t.dt),this.acc+=t.dt,this.acc<.2)return;this.acc=0;const e=t.state.agents.find(r=>r.role==="integrator");this.screen.setGain(t.pal.screenGain);const s=!e||e.phase==="offline"?"off":e.pose==="review"||e.phase==="reviewing"?"review":e.pose==="wait"?"wait":"idle";this.screen.draw(s,t.t,"#8a7ae8",e?e.phaseProgress:0)}}class H_{group=new kt;rackC=Vn(32,56,!1);rackAcc=0;lastCommits=-1;lastDeploy=-1;flash=0;beacon;rocket=new kt;lights=[];launch={phase:"idle",t:0};button;padGlow;rackGlow;ctx;constructor(t){this.ctx=t;const e=new be,n=We.mainRack.prop.x,s=-9.9;e.box(n,1.2,s-.5,1.4,2.4,1,2304058),e.box(n,2.42,s-.5,1.5,.06,1.1,3818080),e.box(n,.05,s-.5,1.5,.1,1.1,1382442);for(const m of[-1,1])e.box(n+m*.7,1.2,s+.02,.06,2.3,.06,3818080);e.box(n+.9,.12,s+.35,.5,.06,.08,3840728,.6).box(n-.9,.12,s+.5,.5,.06,.08,14196794,-.4);const r=13,a=-6;e.box(r,.12,a,1.6,.24,1.6,3817552),e.box(r,.26,a,1.4,.04,1.4,5594480);for(let m=0;m<4;m++)e.box(r+(m%2?.35:-.35),.28,a+(m<2?.35:-.35),.5,.01,.1,16765530,m%2?.8:-.8);for(const m of[-.55,.55])e.box(r+.62,1.25,a+m,.12,2.5,.12,13126202);for(let m=0;m<5;m++)e.box(r+.62,.4+m*.5,a,.1,.07,1.1,15231578);e.box(r+.3,1.55,a,.7,.07,.12,13126202),e.box(r-1.4,.4,a,.45,.8,.45,3028038),e.box(r-1.4,.82,a,.5,.05,.5,4870760,0,-.35),this.group.add(Fe(e,t.sh.vc));const o=new Rt(new Te(1.2,2.1),new Xt({map:this.rackC.tex,toneMapped:!1}));o.position.set(n,1.22,s+.012),this.group.add(o),this.beacon=new Xt({color:3866490,toneMapped:!1});const l=new Rt(new Ie(.22,.2,.22),this.beacon);l.position.set(n,2.6,s-.5),this.group.add(l);const c=mi(t,"MAIN","#1a3a2a","#7dffa0","#3aff7a",.34,2);c.position.set(n,3,-10.94),this.group.add(c),this.rackGlow=new Xt({map:os(),color:3866490,transparent:!0,opacity:0,blending:$n,depthWrite:!1,toneMapped:!1});const f=new Rt(new Te(5,4),this.rackGlow);f.rotation.x=-Math.PI/2,f.position.set(n,.075,s+1),this.group.add(f);const h=new be;h.box(0,.75,0,.5,1.2,.5,15921912),h.box(0,1.5,0,.4,.3,.4,16734794).box(0,1.72,0,.26,.2,.26,16734794).box(0,1.88,0,.12,.14,.12,16734794),h.box(0,.35,0,.54,.12,.54,16734794);for(const[m,d]of[[.35,0],[-.35,0],[0,.35],[0,-.35]])h.box(m,.32,d,m?.2:.1,.4,d?.2:.1,3003583);h.box(0,.12,0,.3,.12,.3,3816004),h.box(0,1,.26,.22,.22,.04,4901119).box(0,1,.25,.28,.28,.02,2763322),h.box(.26,1,0,.04,.22,.22,4901119);const u=Fe(h,t.sh.vc);this.rocket.add(u),this.rocket.position.set(r,.28,a),this.group.add(this.rocket);for(let m=0;m<4;m++){const d=new Xt({color:16756784,toneMapped:!1});this.lights.push(d);const E=new Rt(new Ie(.14,.14,.14),d);E.position.set(r+(m%2?.7:-.7),.31,a+(m<2?.7:-.7)),this.group.add(E)}this.button=new Xt({color:15026253,toneMapped:!1});const p=new Rt(new Ie(.2,.08,.2),this.button);p.position.set(r-1.4,.9,a),p.rotation.x=-.35,this.group.add(p);const g=mi(t,"DEPLOY","#3a1a1a","#ffd0a0","#ff8a4a",.22,1);g.position.set(r-1.4,1.2,a+.3),g.rotation.y=Math.PI/4,this.group.add(g),this.padGlow=new Xt({map:os(),color:16752704,transparent:!0,opacity:0,blending:$n,depthWrite:!1,toneMapped:!1});const _=new Rt(new Te(4.5,4.5),this.padGlow);_.rotation.x=-Math.PI/2,_.position.set(r,.3,a),this.group.add(_)}drawRack(t,e){const{ctx:n,tex:s}=this.rackC;n.fillStyle="#101424",n.fillRect(0,0,32,56);for(let r=0;r<9;r++){const a=2+r*6;n.fillStyle=e>0?`rgb(${Math.round(20+30*e)},${Math.round(50+70*e)},${Math.round(30+30*e)})`:"#1d2338",n.fillRect(2,a,28,5),n.fillStyle="#0a0d1a",n.fillRect(4,a+1,12,3);for(let o=0;o<6;o++){const l=e>.05?!0:(Math.floor(t*(2+r%3))+o*3+r*5)%7<3;n.fillStyle=e>.05?"#5dff8a":l?o%3===0?"#ffb030":"#3aff7a":"#143a22",n.fillRect(18+o*2,a+1,1,1),n.fillRect(18+o*2,a+3,1,1)}}s.needsUpdate=!0}update(t){const e=t.state;if(this.lastCommits<0&&(this.lastCommits=e.mainCommits??0),e.mainCommits>this.lastCommits){this.flash=1;const o=We.mainRack.prop.x;this.ctx.fx.confetti(o,2.7,-9.4,34,3),this.ctx.fx.sparks(o,1.5,-9.7,14,8257440,2.5)}this.lastCommits=e.mainCommits??0,this.flash=Math.max(0,this.flash-t.dt*.7),this.rackAcc+=t.dt,this.rackAcc>(t.reduced?.4:.14)&&(this.rackAcc=0,this.drawRack(t.t,this.flash)),this.beacon.color.setHex(this.flash>.05?12124104:Math.floor(t.t*1.5)%2?3866490:1739332),this.rackGlow.opacity=this.flash*.7*(.5+t.pal.lampStrength*.5),this.lastDeploy<0&&(this.lastDeploy=e.deployments??0),(e.deployments??0)>this.lastDeploy&&this.launch.phase==="idle"&&(this.launch.phase="count",this.launch.t=0),this.lastDeploy=e.deployments??0;const n=this.launch;n.t+=t.dt;const s=13,r=-6;let a=0;if(n.phase==="idle"){this.rocket.position.set(s,.28,r),this.rocket.scale.setScalar(1);const o=Math.floor(t.t*1.2)%4;this.lights.forEach((l,c)=>l.color.setHex(c===o?16765040:9067028)),this.button.color.setHex(15026253)}else if(n.phase==="count"){const o=Math.floor(t.t*8)%2;this.lights.forEach(l=>l.color.setHex(o?16726586:5902352)),this.button.color.setHex(o?16751258:15026253),this.rocket.position.set(s+(Math.random()-.5)*.02,.28,r+(Math.random()-.5)*.02),a=.6,n.t>1.6&&(n.phase="fly",n.t=0)}else if(n.phase==="fly"){this.lights.forEach(l=>l.color.setHex(3866490));const o=.28+.5*5.5*n.t*n.t;this.rocket.position.set(s,o,r),a=1;for(let l=0;l<3;l++)this.ctx.fx.spawn(s+(Math.random()-.5)*.3,o+.1,r+(Math.random()-.5)*.3,(Math.random()-.5)*1,-1.5-Math.random()*1.5,(Math.random()-.5)*1,.7+Math.random()*.5,.2+Math.random()*.15,[16765530,16747066,14737640][l%3],-1.5,0);n.t>.6&&n.t<.65&&this.ctx.fx.sparks(s,.5,r,6,16765530,3),o>16&&(n.phase="hidden",n.t=0,this.rocket.scale.setScalar(1e-4))}else if(n.phase==="hidden")this.lights.forEach(o=>o.color.setHex(3866490)),n.t>1.2&&(n.phase="return",n.t=0,this.rocket.position.set(s,.28,r));else{const o=Math.min(1,n.t/.7);this.rocket.scale.setScalar(Math.max(1e-4,o)),o>=1&&(n.phase="idle",n.t=0)}this.padGlow.opacity=a*.5*(.7+t.pal.lampStrength*.3)}}const Uo=32,Eh=.4,Lr={pr:{main:16119807,keel:4155096},merged:{main:5951866,keel:1800768,label:"LGTM"},changes:{main:15026253,keel:8002080,label:"changes"},help:{main:16765530,keel:13142544,label:"?"},help_reply:{main:3003583,keel:1014384},assign:{main:11569919,keel:5911744},chat:{main:16751178,keel:12081684},broadcast:{main:16777215,keel:9082032}};function G_(i,t){const e=[0,0,.36],n=[0,0,-.3],s=[-.34,.1,-.26],r=[.34,.1,-.26],a=[0,-.14,-.28],o=[0,.05,-.1],l=[{v:[e,n,s],c:i},{v:[e,r,n],c:i},{v:[e,o,n],c:t},{v:[e,n,a],c:t},{v:[n,s,o],c:i},{v:[n,o,r],c:i}],c=[],f=[],h=new Tt;for(const p of l){h.set(p.c);for(const g of p.v)c.push(g[0],g[1],g[2]),f.push(h.r,h.g,h.b)}const u=new Ge;return u.setAttribute("position",new Ce(c,3)),u.setAttribute("color",new Ce(f,3)),u}const Dr=new F,Ir=new F,ln=new F,Ta=new F;class Ql{constructor(t){this.fx=t;for(const a of Object.keys(Lr))this.geos[a]=G_(Lr[a].main,Lr[a].keel);const e=Vn(14,14,!1);e.ctx.fillStyle="#10141f",e.ctx.fillRect(0,0,14,14),e.ctx.fillStyle="#ffd25a",e.ctx.fillRect(1,1,12,12),re(e.ctx,"?",7,3,"#10141f",1),e.tex.needsUpdate=!0;const n=new cf({map:e.tex,toneMapped:!1}),s=new Kl(.3,10);s.rotateX(-Math.PI/2);const r=new Xt({color:0,transparent:!0,opacity:.4,depthWrite:!1,toneMapped:!1});for(let a=0;a<Uo;a++){const o=new Rt(s,r);o.visible=!1,o.renderOrder=2,this.group.add(o);const l=new kt,c=new Rt(this.geos.pr,this.mat);c.castShadow=!1,l.add(c);const f=new qg(n);f.scale.set(.4,.4,1),f.position.set(0,.5,0),f.visible=!1,l.add(f),l.visible=!1,this.group.add(l),this.slots.push({group:l,mesh:c,shadow:o,q:f,emit:0,id:"",kind:""})}}group=new kt;slots=[];geos={};mat=new Xt({vertexColors:!0,side:Ln,toneMapped:!1});landed=new Set;seen=new Set;tags=[];onLand=null;static hash(t){let e=0;for(let n=0;n<t.length;n++)e=e*31+t.charCodeAt(n)|0;return(e>>>0)/4294967296}path(t,e,n,s,r,a,o){const l=n*n*(3-2*n)*.55+n*.45;o.lerpVectors(t,e,l),o.y+=4*n*(1-n)*s;const c=e.x-t.x,f=e.z-t.z,h=Math.hypot(c,f)||1,u=Math.sin(n*Math.PI*4+a)*r*Math.sin(Math.PI*n);return o.x+=-f/h*u,o.z+=c/h*u,o}update(t,e,n,s){const r=t.time,a=t.flights??[];this.tags.length=0,this.seen.clear();let o=0;for(let l=0;l<a.length&&o<Uo;l++){const c=a[l],f=c.t0+c.dur;if(r<c.t0||r>f+Eh||(this.seen.add(c.id),!n(c.from,Dr,!0)||!n(c.to,Ir,!1)))continue;const h=this.slots[o++],u=h.group,p=Lr[c.kind]??Lr.broadcast;h.kind!==c.kind&&(h.mesh.geometry=this.geos[c.kind]??this.geos.broadcast,h.kind=c.kind),h.q.visible=c.kind==="help";const g=Math.hypot(Ir.x-Dr.x,Ir.z-Dr.z),_=Math.min(2.6,.5+g*.2),m=Ql.hash(c.id)*6.28,d=Math.min(.35,.08+g*.02),E=Math.min(1,Math.max(0,(r-c.t0)/Math.max(.1,c.dur)));this.path(Dr,Ir,E,_,d,m,ln);let y=1;if(r>f){const S=Math.min(1,(r-f)/Eh);if(y=1-S*S,ln.y-=S*.15,!this.landed.has(c.id)){this.landed.add(c.id);const O=p.main;for(let T=0;T<10;T++){const R=Math.random()*Math.PI*2,I=.5+Math.random()*1.1;this.fx.spawn(ln.x,ln.y,ln.z,Math.cos(R)*I,.8+Math.random()*1.5,Math.sin(R)*I,.55+Math.random()*.35,.07+Math.random()*.04,T%3?O:16777215,5,6,!0)}this.onLand?.(c)}}if(this.path(Dr,Ir,Math.min(1,E+.03),_,d,m,Ta),u.position.copy(ln),r<=f&&(u.lookAt(Ta.x,Ta.y,Ta.z),u.rotateZ(Math.cos(E*Math.PI*4+m)*.5*Math.sin(Math.PI*E))),u.scale.setScalar(Math.max(.001,y)*1.5),u.visible=!0,h.shadow.visible=!0,h.shadow.position.set(ln.x,.075,ln.z),h.shadow.scale.setScalar(Math.max(.05,y)*(.8+Math.min(1,ln.y*.3))),r<=f)for(h.emit+=e*14;h.emit>=1;)h.emit-=1,this.fx.spawn(ln.x+(Math.random()-.5)*.06,ln.y-.02,ln.z+(Math.random()-.5)*.06,(Math.random()-.5)*.15,-.05,(Math.random()-.5)*.15,.45,.1,p.main,0,3,!0);if(s){let S="";c.kind==="pr"?S=c.ticketId??c.label??"":c.kind==="merged"?S="LGTM":c.kind==="changes"?S="changes":c.kind==="help"?S="help":S=c.label??"",S&&y>.2&&this.tags.push({key:c.id,text:S,color:"#"+p.main.toString(16).padStart(6,"0"),x:ln.x,y:ln.y+.55,z:ln.z})}}for(let l=o;l<Uo;l++)this.slots[l].group.visible=!1,this.slots[l].shadow.visible=!1;if(this.landed.size>64)for(const l of this.landed)this.seen.has(l)||this.landed.delete(l)}}const he=128,Hs=72,Ki={x:6.9,y:3,z:-10.84},Gs=3,Bs=Gs*Hs/he;function No(i){i=Math.max(0,Math.floor(i));const t=Math.floor(i/3600),e=Math.floor(i%3600/60),n=i%60,s=r=>String(r).padStart(2,"0");return t>0?`${t}:${s(e)}:${s(n)}`:`${s(e)}:${s(n)}`}function Aa(i,t){return i.length>t?i.slice(0,t):i}const wh={idle:"#7f8ab0",kickoff:"#4ac8ff",build:"#ffd25a",polish:"#c792ea",demo:"#ff9a4a",submitted:"#5ad17a"};class V_{group=new kt;c=Vn(he,Hs,!0);mat;acc=99;beat=0;lastStage="";lastSig="";confettiAcc=0;fx;constructor(t){this.fx=t.fx;const e=new be,{x:n,y:s,z:r}=Ki;e.box(n,s,r-.04,Gs+.22,Bs+.22,.12,1711142),e.box(n,s-Bs/2-.16,r-.02,Gs*.5,.06,.1,2764346),e.box(n,s+Bs/2+.2,r-.05,.9,.05,.05,2764346);for(const o of[-1,1])e.box(n+o*(Gs/2+.06),s,r+.01,.03,Bs+.22,.03,3817038);e.box(n+Gs/2-.1,s-Bs/2-.07,r+.03,.05,.025,.02,5951866),this.group.add(Fe(e,t.sh.vc,!1,!1)),this.mat=new Xt({map:this.c.tex,toneMapped:!1});const a=new Rt(new Te(Gs,Bs),this.mat);a.position.set(n,s,r+.025),this.group.add(a),this.draw(null,0)}bar(t,e,n,s,r,a){const{ctx:o}=this.c;o.fillStyle="#05060e",o.fillRect(t,e,n,s),o.fillStyle="#2a3150",o.fillRect(t+1,e+1,n-2,s-2),o.fillStyle=a,o.fillRect(t+1,e+1,Math.round((n-2)*Math.max(0,Math.min(1,r))),s-2)}drawLive(t,e){const{ctx:n,tex:s}=this.c,r=t.hack,a=t.metrics?.merged??0,o=t.tickets?.length??0,l=r.active?r.stage==="polish"?"FREEZE":r.stage==="demo"?"DEMO":"BUILD":"";if(n.fillStyle="#262e4a",n.fillRect(0,0,he,10),n.fillStyle="#d97757",n.fillRect(0,0,3,10),ne(n,"DEMO",6,1,"#ffffff",1),l){const f=un(l)+6;n.fillStyle=wh[r.stage]??"#9aa4c0",n.fillRect(he-f-2,1,f,8),ne(n,l,he-f+1,2,"#10141f",1)}if(!r.active)re(n,"NO DEMO TIME",he/2,26,"#9fb0e0",1);else{const f=r.endsAt-t.time,h=f/60,u=f<=0||h<=5?"#ff4a52":h<=15?"#ffb23c":"#7dff9a";(f<=0||h<=5)&&!e&&this.beat%2===0&&(n.fillStyle="#3a0c14",n.fillRect(0,10,he,31)),re(n,f<=0?"TIME":"DEMO IN",he/2,13,"#9fb0e0",1);const p=f<=0?"00:00":No(f),g=p.length>5?2:3;re(n,p,he/2,g===3?22:25,u,g)}ne(n,"DONE",4,50,"#9fb0e0",1),this.bar(30,49,66,9,o?a/o:0,"#5ad17a");const c=a+"/"+o;ne(n,c,he-4-un(c),50,"#ffffff",1),s.needsUpdate=!0}draw(t,e,n=!1,s=!1){const{ctx:r,tex:a}=this.c;r.fillStyle="#0b0e1c",r.fillRect(0,0,he,Hs);const o=t?.hack;if(t&&o&&n){this.drawLive(t,s);return}if(!t||!o){re(r,"STANDBY",he/2,32,"#4a5278",2),a.needsUpdate=!0;return}const l=this.beat%2===0,c=t.metrics?.merged??0,f=Math.max(t.plan?.totalTickets??0,t.tickets?.length??0,c);if(!o.active){r.fillStyle="#262e4a",r.fillRect(0,0,he,11),r.fillStyle="#d97757",r.fillRect(0,0,4,11),r.fillStyle="#2dd4bf",r.fillRect(4,0,2,11),ne(r,"SPRINT",10,2,"#ffffff",1);const M=(t.plan?.name??"PLAN").toUpperCase();ne(r,Aa(M,20),4,15,"#9fb0e0",1),M.length>20&&ne(r,Aa(M.slice(20),20),4,23,"#9fb0e0",1),ne(r,"SIM TIME",4,33,"#7f8ab0",1);const A=No(t.time),V=A.length>5?2:3;re(r,A,he/2,41,"#e8ecff",V);const z=t.plan?.deadlineMinutes??0;z>0?this.bar(4,62,120,6,t.time/(z*60),"#5ad17a"):ne(r,"MERGED "+c+"/"+f,4,62,"#5ad17a",1),a.needsUpdate=!0;return}const h=o.endsAt-t.time,u=o.stage==="submitted",p=wh[o.stage]??"#9aa4c0";r.fillStyle="#262e4a",r.fillRect(0,0,he,10),r.fillStyle="#d97757",r.fillRect(0,0,3,10);const g=o.stage.toUpperCase(),_=un(g)+6,m=Aa((o.project||"HACKATHON").toUpperCase(),Math.max(3,Math.floor((he-_-12)/6)));if(ne(r,m,6,1,"#ffffff",1),r.fillStyle=p,r.fillRect(he-_-2,1,_,8),ne(r,g,he-_+1,2,"#10141f",1),u){r.fillStyle=l?"#5ad17a":"#2f8a4c",r.fillRect(0,10,he,2),r.fillRect(0,Hs-2,he,2),r.fillRect(0,10,2,Hs-10),r.fillRect(he-2,10,2,Hs-10),re(r,"SUBMITTED",he/2,21,"#7dff9a",2),re(r,"GOOD LUCK!",he/2,36,"#c8ffd8",1),re(r,"MERGED "+c+"/"+f,he/2,46,"#ffffff",1),re(r,Aa((o.pitch||"").toUpperCase(),21),he/2,56,"#ffd25a",1),this.bar(14,65,100,5,1,"#5ad17a"),a.needsUpdate=!0;return}const d=h/60,E=h<=0||d<=5?"#ff4a52":d<=15?"#ffb23c":"#7dff9a";(h<=0||d<=5)&&l&&(r.fillStyle="#3a0c14",r.fillRect(0,10,he,31)),re(r,h<=0?"TIME":"DEMO IN",he/2,13,"#9fb0e0",1);const S=No(h),O=S.length>5?2:3;re(r,S,he/2,O===3?22:25,E,O),ne(r,"READY",4,45,"#9fb0e0",1);const T=Math.round(Math.max(0,Math.min(1,o.demoReadiness))*100);this.bar(38,44,66,9,o.demoReadiness,T>=80?"#5ad17a":T>=50?"#ffd25a":"#4ac8ff"),ne(r,T+"%",108,45,"#ffffff",1);const R=o.deployStatus==="live"?"#5ad17a":o.deployStatus==="building"?l?"#ffd25a":"#a07c1c":o.deployStatus==="failed"?"#ff4a52":"#5a6488",I="DEPLOY "+(o.deployStatus==="none"?"--":o.deployStatus.toUpperCase());r.fillStyle=R,r.fillRect(3,56,un(I)+4,9),ne(r,I,5,57,"#10141f",1);const b="CUTS "+o.scopeCuts;ne(r,b,he-4-un(b),57,o.scopeCuts>0?"#ff9a4a":"#7f8ab0",1),ne(r,"MERGED "+c+"/"+f,4,66,"#c8d0f0",1),a.needsUpdate=!0}update(t){const e=t.state;this.mat.color.setScalar(t.pal.screenGain);const n=e.hack?.stage??"",s=n!==this.lastStage;this.acc+=t.dt,(s||this.acc>=.5)&&(this.acc=0,this.beat++,this.lastStage=n,this.draw(e,t.t,!!t.live,t.reduced),s&&n==="submitted"&&!t.live&&this.fx.confetti(Ki.x,Ki.y+1.2,Ki.z+.5,70,2.4)),n==="submitted"&&!t.reduced&&(this.confettiAcc+=t.dt,this.confettiAcc>3.5&&(this.confettiAcc=0,this.fx.confetti(Ki.x+(Math.random()-.5)*2.4,Ki.y+1.6,Ki.z+.6,22,1.4)))}}const zs=new ue,Th=new cs,Ah=new In,Rh=new F,Fo=new F,Ch=new Tt;class W_{mesh;n;px;py;pz;vx;vy;vz;life;max;size;grav;rx;ry;spin;shrink;next=0;active=0;constructor(t=480){this.n=t;const e=new Xt({toneMapped:!1});this.mesh=new Ua(new Ie(1,1,1),e,t),this.mesh.frustumCulled=!1,this.mesh.instanceMatrix.setUsage(bl),this.mesh.instanceColor=new wl(new Float32Array(t*3),3),this.mesh.instanceColor.setUsage(bl);const n=()=>new Float32Array(t);this.px=n(),this.py=n(),this.pz=n(),this.vx=n(),this.vy=n(),this.vz=n(),this.life=n(),this.max=n(),this.size=n(),this.grav=n(),this.rx=n(),this.ry=n(),this.spin=n(),this.shrink=new Uint8Array(t),zs.makeScale(0,0,0);for(let s=0;s<t;s++)this.mesh.setMatrixAt(s,zs);this.mesh.count=t}spawn(t,e,n,s,r,a,o,l,c,f=6,h=0,u=!0){const p=this.next;this.next=(this.next+1)%this.n,this.life[p]<=0&&this.active++,this.px[p]=t,this.py[p]=e,this.pz[p]=n,this.vx[p]=s,this.vy[p]=r,this.vz[p]=a,this.life[p]=o,this.max[p]=o,this.size[p]=l,this.grav[p]=f,this.rx[p]=Math.random()*6,this.ry[p]=Math.random()*6,this.spin[p]=h,this.shrink[p]=u?1:0,Ch.set(c),this.mesh.setColorAt(p,Ch),this.mesh.instanceColor.needsUpdate=!0}confetti(t,e,n,s=40,r=3.2){const a=[16734826,16765530,5951866,5945599,14251863,3003583,15235577,16777215];for(let o=0;o<s;o++){const l=Math.random()*Math.PI*2,c=(.3+Math.random()*.7)*r;this.spawn(t,e,n,Math.cos(l)*c,2.5+Math.random()*3.5,Math.sin(l)*c,1.6+Math.random()*1.2,.07+Math.random()*.06,a[o%a.length],7,6+Math.random()*8)}}sparks(t,e,n,s,r,a=2){for(let o=0;o<s;o++){const l=Math.random()*Math.PI*2,c=(.3+Math.random())*a;this.spawn(t,e,n,Math.cos(l)*c,1+Math.random()*2.5,Math.sin(l)*c,.5+Math.random()*.5,.06,r,6,0)}}update(t){if(this.active<=0)return;let e=0;for(let n=0;n<this.n;n++){if(this.life[n]<=0)continue;if(this.life[n]-=t,this.life[n]<=0){zs.makeScale(0,0,0),this.mesh.setMatrixAt(n,zs);continue}e++,this.vy[n]-=this.grav[n]*t;const s=Math.exp(-.6*t);this.vx[n]*=s,this.vz[n]*=s,this.px[n]+=this.vx[n]*t,this.py[n]+=this.vy[n]*t,this.pz[n]+=this.vz[n]*t,this.py[n]<.05&&this.grav[n]>0&&(this.py[n]=.05,this.vy[n]=0,this.vx[n]*=.7,this.vz[n]*=.7);const r=this.shrink[n]?Math.min(1,this.life[n]/(this.max[n]*.35)):1,a=this.size[n]*r;this.rx[n]+=this.spin[n]*t,this.ry[n]+=this.spin[n]*.7*t,Ah.set(this.rx[n],this.ry[n],0),Th.setFromEuler(Ah),Rh.set(this.px[n],this.py[n],this.pz[n]),Fo.set(a,a*.35+a*0,a),this.spin[n]===0&&Fo.set(a,a,a),zs.compose(Rh,Th,Fo),this.mesh.setMatrixAt(n,zs)}this.active=e,this.mesh.instanceMatrix.needsUpdate=!0}}const X_=`
.ab-labels{position:absolute;inset:0;overflow:hidden;pointer-events:none;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,'Courier New',monospace;-webkit-font-smoothing:none;}
.ab-tag{position:absolute;left:0;top:0;will-change:transform;display:none;}
.ab-tagin{transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;gap:3px;}
.ab-card{background:rgba(18,14,32,.86);border:1px solid var(--pc);box-shadow:0 0 0 1px #000,2px 2px 0 rgba(0,0,0,.45);padding:2px 5px 3px;color:#f2ecff;font-size:9px;line-height:11px;font-weight:700;letter-spacing:.1px;white-space:nowrap;display:flex;flex-direction:column;gap:1px;min-width:0;}
.ab-card.sel{box-shadow:0 0 0 1px #000,0 0 0 2px var(--pc),2px 3px 0 2px rgba(0,0,0,.5);background:rgba(26,20,46,.94);}
.ab-r{display:flex;align-items:center;gap:4px;}
.ab-dot{width:7px;height:7px;background:var(--pc);box-shadow:0 0 0 1px #000;flex:none;}
.ab-name{text-shadow:1px 1px 0 #000;}
.ab-tier{font-size:8px;line-height:9px;padding:0 3px;background:var(--tc);color:#10101c;box-shadow:0 0 0 1px #000;text-transform:uppercase;}
.ab-model{font-size:8px;color:#b9b0d8;font-weight:600;}
.ab-owner{font-size:8px;color:#e8e2ff;padding-left:4px;border-left:3px solid var(--oc);font-weight:600;}
.ab-skills{display:flex;gap:2px;}
.ab-sk{font-size:7px;line-height:9px;min-width:11px;text-align:center;padding:0 1px;color:#10101c;box-shadow:0 0 0 1px #000;font-weight:800;}
.ab-labels.compact .ab-card:not(.sel) .ab-r2,.ab-labels.compact .ab-card:not(.sel) .ab-skills{display:none !important;}
.ab-q{font-size:9px;line-height:9px;padding:0 3px;background:#ffd25a;color:#10141f;box-shadow:0 0 0 1px #000;font-weight:900;display:none;}
.ab-more{font-size:9px;color:#d8d0f0;font-weight:600;border-top:1px dashed rgba(255,255,255,.2);margin-top:1px;padding-top:2px;display:flex;flex-direction:column;gap:1px;}
.ab-cost{color:#ffd25a;}
.ab-tier:empty,.ab-model:empty{display:none;}
.ab-fl{position:absolute;left:0;top:0;will-change:transform;display:none;pointer-events:none;}
.ab-fli{transform:translate(-50%,-100%);font-size:9px;line-height:10px;font-weight:800;padding:0 4px 1px;background:#10141f;color:#fff;border:1px solid var(--fc);box-shadow:0 0 0 1px #000,2px 2px 0 rgba(0,0,0,.45);white-space:nowrap;text-shadow:1px 1px 0 #000;}
.ab-bub{max-width:190px;background:#fffbe8;color:#1c1830;border:2px solid #1c1830;padding:3px 6px;font-size:10px;line-height:12px;font-weight:700;white-space:normal;text-align:center;box-shadow:2px 2px 0 rgba(0,0,0,.4);position:relative;margin-bottom:3px;}
.ab-bub:after{content:'';position:absolute;left:50%;bottom:-7px;margin-left:-4px;border:4px solid transparent;border-top:5px solid #1c1830;}
`,Y_={haiku:"#7ee8a2",sonnet:"#7ab8ff",opus:"#c79bff",fable:"#ff9ad2",mini:"#7ee8d2",standard:"#9ad0ff",max:"#ffb87a"};function q_(i){return Y_[i]??"#c8c8d8"}function Z_(i){return i.replace(/^claude-/,"").replace(/^gpt-/,"gpt")}function Ph(i){return"$"+(i>=100?i.toFixed(0):i.toFixed(2))}class K_{root;els=new Map;frame=0;compact=!1;fl=new Map;flFrame=0;constructor(t){if(!document.getElementById("ab-label-css")){const e=document.createElement("style");e.id="ab-label-css",e.textContent=X_,document.head.appendChild(e)}this.root=document.createElement("div"),this.root.className="ab-labels",t.appendChild(this.root)}make(){const t=document.createElement("div");t.className="ab-tag";const e=document.createElement("div");e.className="ab-tagin";const n=document.createElement("div");n.className="ab-bub",n.style.display="none";const s=document.createElement("div");s.className="ab-card";const r=document.createElement("div");r.className="ab-r";const a=document.createElement("span");a.className="ab-dot";const o=document.createElement("span");o.className="ab-name";const l=document.createElement("span");l.className="ab-tier";const c=document.createElement("span");c.className="ab-q",c.textContent="?",r.append(a,o,l,c);const f=document.createElement("div");f.className="ab-r ab-r2";const h=document.createElement("span");h.className="ab-model";const u=document.createElement("span");u.className="ab-owner",f.append(h,u);const p=document.createElement("div");p.className="ab-skills";const g=document.createElement("div");g.className="ab-more",g.style.display="none";const _=document.createElement("div"),m=document.createElement("div");return m.className="ab-cost",g.append(_,m),s.append(r,f,p,g),e.append(n,s),t.appendChild(e),this.root.appendChild(t),{root:t,card:s,name:o,q:c,tier:l,model:h,owner:u,skills:p,more:g,l1:_,l2:m,bub:n,key:{},lastT:"",seen:0}}set(t,e,n,s){t.key[e]!==n&&(t.key[e]=n,s())}update(t,e,n,s=!1,r=null){this.frame++,s!==this.compact&&(this.compact=s,this.root.classList.toggle("compact",s));for(const a of t){let o=this.els.get(a.id);if(o||(o=this.make(),this.els.set(a.id,o)),o.seen=this.frame,!(a.visible&&(e||n&&!!a.bubble))){o.key.d!=="0"&&(o.key.d="0",o.root.style.display="none");continue}o.key.d!=="1"&&(o.key.d="1",o.root.style.display="block");const c=`translate3d(${Math.round(a.x)}px,${Math.round(a.y)}px,0)`;if(c!==o.lastT&&(o.lastT=c,o.root.style.transform=c,o.root.style.zIndex=String(Math.round(a.y)+(a.selected?1e3:0))),this.set(o,"cardv",e?"1":"0",()=>{o.card.style.display=e?"flex":"none"}),e){const h=Dl[a.provider]?.color??"#94a3b8";this.set(o,"pc",h,()=>{o.card.style.setProperty("--pc",h)});const u=a.phase==="asking_help"||a.phase==="awaiting_help"?"1":"0";this.set(o,"q",u,()=>{o.q.style.display=u==="1"?"inline-block":"none"}),this.set(o,"name",a.name,()=>{o.name.textContent=a.name});const p=q_(a.tier);this.set(o,"tier",a.tier+p,()=>{o.tier.textContent=a.tier,o.tier.style.setProperty("--tc",p)});const g=Z_(a.model);this.set(o,"model",g,()=>{o.model.textContent=g}),this.set(o,"owner",a.owner+a.ownerColor,()=>{o.owner.textContent="@"+a.owner,o.owner.style.setProperty("--oc",a.ownerColor)});const _=a.skills.join(",")+(r?a.skills.map(m=>{const d=r(m);return d.color+d.glyph}).join(""):"");this.set(o,"skills",_,()=>{o.skills.textContent="";for(const m of a.skills){const d=r?r(m):{name:m,color:"#9aa4c0",glyph:m.slice(0,2).toUpperCase()},E=document.createElement("span");E.className="ab-sk",E.textContent=d.glyph,E.style.background=d.color,E.title=d.name,o.skills.appendChild(E)}o.skills.style.display=a.skills.length?"flex":"none"}),this.set(o,"sel",a.selected?"1":"0",()=>{o.card.classList.toggle("sel",a.selected),o.more.style.display=a.selected?"flex":"none"}),a.selected&&(this.set(o,"l1",`${a.ticketId??"--"} ${a.phase}`,()=>{o.l1.textContent=`${a.ticketId??"no task"} · ${a.phase.replace(/_/g," ")}`}),this.set(o,"l2",Ph(a.cost)+"|"+(a.burn>.005?a.burn.toFixed(2):""),()=>{o.l2.textContent=Ph(a.cost)+(a.burn>.005?`  $${a.burn.toFixed(2)}/min`:"")}))}const f=n&&a.bubble?a.bubble:"";this.set(o,"bub",f,()=>{o.bub.textContent=f,o.bub.style.display=f?"block":"none"})}for(const[a,o]of this.els)o.seen!==this.frame&&(o.root.parentNode?.removeChild(o.root),this.els.delete(a))}updateFlights(t){this.flFrame++;for(const e of t){let n=this.fl.get(e.key);if(!n){const r=document.createElement("div");r.className="ab-fl";const a=document.createElement("div");a.className="ab-fli",r.appendChild(a),this.root.appendChild(r),n={root:r,inner:a,seen:0,t:"",txt:"",col:""},n.root.style.display="block",this.fl.set(e.key,n)}n.seen=this.flFrame;const s=`translate3d(${Math.round(e.x)}px,${Math.round(e.y)}px,0)`;s!==n.t&&(n.t=s,n.root.style.transform=s,n.root.style.zIndex="2000"),n.txt!==e.text&&(n.txt=e.text,n.inner.textContent=e.text),n.col!==e.color&&(n.col=e.color,n.inner.style.setProperty("--fc",e.color))}for(const[e,n]of this.fl)n.seen!==this.flFrame&&(n.root.parentNode?.removeChild(n.root),this.fl.delete(e))}dispose(){this.root.parentNode?.removeChild(this.root)}}const $_=new Set(["type","think","wait","blocked","sleep","review","raise_hand","throw"]),j_={depot:1.2,inbox:1,outTray:1,library:1.7,vault:1.1,board:2.3,orchSeat:1.1,integSeat:1.1,mainRack:1.5,deployRack:1.5},J_=[...Il.map(i=>i.seat),We.orchSeat.stand,We.integSeat.stand],Q_=["depot","inbox","outTray"],tx={kind:"tickets",count:1},ex={to_depot:()=>({station:"depot"}),to_library:()=>({station:"library"}),to_desk:i=>({desk:i.deskIndex}),to_review:()=>({station:"inbox"}),rework_pickup:()=>({station:"outTray"}),delivering:()=>({station:"depot"}),returning:()=>({station:"outTray"})};function nx(i){let t=2166136261;for(let e=0;e<i.length;e++)t^=i.charCodeAt(e),t=Math.imul(t,16777619);return t>>>0}function Lh(i,t,e){let n=(t-i)%(Math.PI*2);return n>Math.PI&&(n-=Math.PI*2),n<-Math.PI&&(n+=Math.PI*2),i+n*e}class sx{constructor(t,e){this.host=t,this.visual={...e},this.container=document.createElement("div"),this.container.style.cssText="position:absolute;inset:0;overflow:hidden;background:#0c0a18;",getComputedStyle(t).position==="static"&&(t.style.position="relative"),t.appendChild(this.container);try{this.reduced=typeof matchMedia=="function"&&matchMedia("(prefers-reduced-motion: reduce)").matches}catch{this.reduced=!1}try{this.init(),this.ok=!0}catch(n){console.warn("[OfficeScene] WebGL unavailable",n),this.container.innerHTML="";const s=document.createElement("div");s.style.cssText="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;color:#d8d0f0;font:14px/1.5 ui-monospace,Menlo,Consolas,monospace;background:#120e22;",s.textContent="The 3D office needs WebGL, which is not available in this browser. The board, agents and stats still work from the panels.",this.container.appendChild(s)}}visual;container;canvas=null;renderer=null;pipeline;scene=new lf;cam;labels;sun;ambient;hemi;sh;room;cubicles;fx;flights;integ;skills=new Jl;stations=[];ring;ringMat;pathLines;pathPos;entries=new Map;selected=null;pickCb=null;ro=null;cssW=1;cssH=1;rtW=2;rtH=2;dpr=1;time=0;frame=0;lastSimTime=-1;simSpeed=1;reduced=!1;pal=Co.dusk;palKey=null;qualityKey=null;ok=!1;hoverId=null;lastPalKey="";labelItems=[];flightTags=[];frameTimes=[];lastAgents=new Map;_v=new F;_focus=new F;init(){const t=document.createElement("canvas");t.style.cssText="position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;outline:none;",this.container.appendChild(t),this.canvas=t;const e=new Xg({canvas:t,antialias:!1,alpha:!1,powerPreference:"high-performance"});this.renderer=e,e.autoClear=!0,e.info.autoReset=!1,e.shadowMap.type=Uh,e.toneMapping=fi,this.pipeline=new c_(e),this.sh=S_(),this.fx=new W_(480),this.ambient=new n1(16777215,1),this.hemi=new Jg(16777215,4473924,1),this.sun=new e1(16777215,1),this.sun.shadow.mapSize.set(2048,2048);const n=this.sun.shadow.camera;n.left=-24,n.right=24,n.top=24,n.bottom=-24,n.near=1,n.far=80,this.sun.shadow.bias=-6e-4,this.sun.shadow.normalBias=.04,this.scene.add(this.ambient,this.hemi,this.sun,this.sun.target),this.room=new T_(this.sh),this.scene.add(this.room.group),this.cubicles=new L_(this.sh),this.scene.add(this.cubicles.group);const s={sh:this.sh,fx:this.fx,tint:this.room.tint},r=new I_(s),a=new Ga(s),o=new U_(s),l=new B_(s),c=new z_(s),f=new k_(s),h=new H_(s),u=new V_(s);this.integ=f;for(const g of[r,a,o,l,c,f,h,u])this.scene.add(g.group),this.stations.push(g);this.scene.add(this.fx.mesh),this.flights=new Ql(this.fx),this.flights.onLand=g=>{g.kind==="pr"&&"station"in g.to&&g.to.station==="inbox"&&this.integ.bumpInbox()},this.scene.add(this.flights.group),this.ringMat=new Xt({color:16771488,transparent:!0,opacity:.95,blending:$n,depthWrite:!1,toneMapped:!1}),this.ring=new Rt(new qa(.52,.72,20),this.ringMat),this.ring.rotation.x=-Math.PI/2,this.ring.visible=!1,this.ring.renderOrder=3,this.scene.add(this.ring),this.pathPos=new Float32Array(640*6);const p=new Ge;p.setAttribute("position",new mn(this.pathPos,3).setUsage(bl)),p.setDrawRange(0,0),this.pathLines=new jg(p,new ff({color:16769354,toneMapped:!1,depthTest:!1})),this.pathLines.frustumCulled=!1,this.pathLines.renderOrder=5,this.pathLines.visible=!1,this.scene.add(this.pathLines),this.cam=new a_(t),this.cam.reducedMotion=this.reduced,this.cam.onClick=(g,_)=>this.handleClick(g,_),this.cam.onHover=(g,_)=>this.handleHover(g,_),this.labels=new K_(this.container),this.ro=new ResizeObserver(()=>this.resize()),this.ro.observe(this.host),this.resize(),this.applyVisual(!0)}get usable(){return this.ok}setVisual(t){this.visual={...t},this.ok&&this.applyVisual(!1)}selectAgent(t){this.selected=t}onPick(t){this.pickCb=t}getCameraState(){return this.cam.getState()}setCamera(t){this.ok&&this.cam.setState(t)}getStats(){const t=this.frameTimes,e=t.length?t.reduce((s,r)=>s+r,0)/t.length:0,n=this.renderer?.info.render;return{frameMs:e,renderTarget:[this.rtW,this.rtH],drawCalls:n?.calls??0,triangles:n?.triangles??0}}sampleWorld(t,e,n,s=5){if(!this.ok||!this.renderer)return null;const r=this.renderer.getContext(),a=new F(t,e,n).project(this.cam.camera),o=r.drawingBufferWidth,l=r.drawingBufferHeight,c=Math.round((a.x*.5+.5)*o),f=Math.round((a.y*.5+.5)*l),h=Math.max(0,c-s),u=Math.max(0,f-s),p=Math.min(o-h,s*2),g=Math.min(l-u,s*2);if(p<=0||g<=0)return null;const _=new Uint8Array(p*g*4);r.readPixels(h,u,p,g,r.RGBA,r.UNSIGNED_BYTE,_);let m=0,d=0,E=0;for(let S=0;S<_.length;S+=4)m+=_[S],d+=_[S+1],E+=_[S+2];const y=_.length/4;return[m/y,d/y,E/y]}resize(){if(!this.ok||!this.renderer)return;const t=this.host.getBoundingClientRect(),e=Math.max(2,Math.floor(t.width)),n=Math.max(2,Math.floor(t.height));this.cssW=e,this.cssH=n,this.dpr=Math.min(2,window.devicePixelRatio||1),this.renderer.setPixelRatio(this.dpr),this.renderer.setSize(e,n,!1);const s=this.pipeline.setSize(e,n,this.visual.pixelSize);this.rtW=s.w,this.rtH=s.h}dispose(){if(this.ro?.disconnect(),this.ok){for(const t of this.entries.values())this.scene.remove(t.rig.object),t.rig.dispose();this.entries.clear(),this.cam.dispose(),this.labels.dispose(),this.scene.traverse(t=>{const e=t;e.geometry&&e.geometry.dispose();const n=e.material;Array.isArray(n)?n.forEach(s=>s.dispose()):n?.dispose()}),this.pipeline.dispose(),this.renderer?.dispose()}this.container.parentNode?.removeChild(this.container)}applyVisual(t){const e=this.visual,n=Co[e.palette]??Co.dusk;(t||this.lastPalKey!==e.palette)&&(this.lastPalKey=e.palette,this.pal=n,this.scene.background=new Tt(n.clear),this.ambient.color.setHex(n.ambient.color),this.ambient.intensity=n.ambient.intensity*Math.PI,this.hemi.color.setHex(n.hemi.sky),this.hemi.groundColor.setHex(n.hemi.ground),this.hemi.intensity=n.hemi.intensity*Math.PI,this.sun.color.setHex(n.sun.color),this.sun.intensity=n.sun.intensity*Math.PI,this.sun.position.set(...n.sun.pos),this.room.applyPalette(n)),this.pipeline.setParams(n,e.dither);const r=e.quality;if(r!==this.qualityKey&&this.renderer){this.qualityKey=r;const a=r==="high";this.renderer.shadowMap.enabled=a,this.sun.castShadow=a,this.scene.traverse(o=>{const l=o.material;Array.isArray(l)?l.forEach(c=>{c.needsUpdate=!0}):l&&(l.needsUpdate=!0)})}this.pipeline.pixelSize!==e.pixelSize&&this.resize(),this.pathLines.visible=e.showPaths}pickAt(t,e){const n=this.container.getBoundingClientRect(),s=t-n.left,r=e-n.top;let a=null,o=30;for(const[l,c]of this.entries){const f=c.fx,h=c.fy,u=c.sx,p=c.sy+10,g=u-f,_=p-h,m=g*g+_*_||1,d=Math.max(0,Math.min(1,((s-f)*g+(r-h)*_)/m)),E=Math.hypot(s-(f+g*d),r-(h+_*d)),y=Math.max(.7,Math.min(2.2,1/(this.cam.halfH/11)));E<o*y&&E/y<o&&(o=E/y,a=l)}return a}handleClick(t,e){this.pickCb?.(this.pickAt(t,e))}handleHover(t,e){const n=this.pickAt(t,e);n!==this.hoverId&&(this.hoverId=n,this.canvas&&(this.canvas.style.cursor=n?"pointer":"grab"))}getEntry(t){let e=this.entries.get(t.id);if(e)return e;const n=i_({provider:t.provider,role:t.role,seed:nx(t.id+t.name),ownerColor:t.ownerColor,name:t.name});return this.scene.add(n.object),e={rig:n,x:t.pos.x,z:t.pos.z,heading:t.heading,inited:!1,compactions:t.compactions??0,phase:null,seen:0,sx:0,sy:0,fx:0,fy:0,pathAcc:99,path:null,castTick:0,label:{id:t.id,name:t.name,provider:t.provider,tier:"",model:"",owner:"",ownerColor:"#888",skills:[],phase:"",ticketId:null,cost:0,burn:0,bubble:null,x:0,y:0,visible:!1,selected:!1}},this.setCast(n.object),this.entries.set(t.id,e),e}setCast(t){t.traverse(e=>{const n=e;n.isMesh&&(n.castShadow=!0,n.receiveShadow=!0)})}syncAgents(t,e){this.frame++;const n=1-Math.exp(-28*e),s=1-Math.exp(-16*e),r=this.frame;for(const a of t.agents){const o=this.getEntry(a);o.seen=r;const l=Math.hypot(a.pos.x-o.x,a.pos.z-o.z);!o.inited||l>2.5?(o.x=a.pos.x,o.z=a.pos.z,o.heading=a.heading,o.inited=!0):(o.x+=(a.pos.x-o.x)*n,o.z+=(a.pos.z-o.z)*n,o.heading=Lh(o.heading,a.heading,s));const c=o.rig.object;c.position.set(o.x,0,o.z),c.rotation.y=o.heading;let f=!1;if($_.has(a.pose)){for(const g of J_)if(Math.hypot(a.pos.x-g.x,a.pos.z-g.z)<.22){f=!0;break}}const h=[];for(const g of a.skills??[])h.push(this.skills.fn(g).color);let u=a.carrying;if(a.pose==="pickup"&&!u)for(const g of Q_){const _=We[g];if(Math.hypot(a.pos.x-_.stand.x,a.pos.z-_.stand.z)<1.3){u=tx;break}}a.pose==="plan"&&Math.hypot(a.pos.x-We.board.stand.x,a.pos.z-We.board.stand.z)<1.2&&(o.heading=Lh(o.heading,0,s)),c.rotation.y=o.heading;const p={pose:a.pose,seated:f,carrying:u,skillColors:h,tier:a.config.tier,subagents:a.activeSubagents,contextFill:a.contextFill,speed:this.simSpeed,selected:a.id===this.selected};o.rig.update(e,p),(a.compactions??0)>o.compactions&&o.rig.flashCompaction(),o.compactions=a.compactions??0,a.phase==="celebrating"&&o.phase!=="celebrating"&&this.fx.confetti(o.x,1.6,o.z,36,2.8),o.phase=a.phase,a.burnUsdPerMin>.15&&!this.reduced&&Math.random()<e*Math.min(2.2,a.burnUsdPerMin*2.5)&&f&&this.fx.spawn(o.x+(Math.random()-.5)*.4,1.5,o.z-.2,0,.7,0,1.1,.09,16765530,-.2,0,!0),++o.castTick%90===0&&this.setCast(c)}for(const[a,o]of this.entries)o.seen!==r&&(this.scene.remove(o.rig.object),o.rig.dispose(),this.entries.delete(a),this.selected===a&&(this.selected=null))}update(t,e){if(!this.ok||!this.renderer)return;const n=performance.now(),s=Math.min(.1,Math.max(1e-4,e||.016));if(this.time+=s,(this.visual.pixelSize!==this.pipeline.pixelSize||Math.min(2,window.devicePixelRatio||1)!==this.dpr)&&this.resize(),this.lastSimTime>=0){const o=Math.max(0,(t.time-this.lastSimTime)/s);this.simSpeed+=(Math.min(8,o)-this.simSpeed)*(1-Math.exp(-4*s))}this.lastSimTime=t.time,this.skills.sync(t.skills),this.syncAgents(t,s);const r={state:t,t:this.time,dt:s,pal:this.pal,reduced:this.reduced,live:!!this.visual.live};this.cubicles.update(t.agents,this.time,s,this.pal,this.reduced);for(const o of this.stations)o.update(r);this.flights.update(t,s,(o,l,c)=>this.resolveEndpoint(o,l,c),this.visual.showLabels),this.fx.update(s);const a=this.selected?this.entries.get(this.selected):void 0;if(a){this.ring.visible=!0,this.ring.position.set(a.x,.09,a.z);const o=1+(this.reduced?0:.08*Math.sin(this.time*5));this.ring.scale.set(o,o,o),this.ringMat.opacity=.7+(this.reduced?.2:.25*Math.sin(this.time*5+1))}else this.ring.visible=!1;this._focus.set(a?a.x:0,.9,a?a.z:0),this.cam.update(s,this.rtW,this.rtH,{on:this.visual.autoOrbit,speed:this.visual.orbitSpeed},this.visual.focus,a?this._focus:null),this.pipeline.setOutlineWorld(Math.max(.2,this.cam.texelWorld*1.6),199),this.visual.showPaths&&this.updatePaths(t,s),this.renderer.info.reset(),this.pipeline.render(this.scene,this.cam.camera),this.updateLabels(t),this.frameTimes.push(performance.now()-n),this.frameTimes.length>60&&this.frameTimes.shift()}resolveEndpoint(t,e,n){if("agent"in t){const r=this.entries.get(t.agent);return r?(e.set(r.x,n?1.25:1.1,r.z),!0):!1}const s=We[t.station];return s?(e.set(s.prop.x,j_[t.station]??1.2,s.prop.z),!0):!1}updateLabels(t){const e=this.cam.camera,n=this.labelItems;n.length=0;const s=this.cssW,r=this.cssH;for(const o of t.agents){const l=this.entries.get(o.id);if(!l)continue;const c=l.rig.headHeight;this._v.set(l.x,Math.max(1.2,c-.95),l.z).project(e),l.sx=(this._v.x*.5+.5)*s,l.sy=(-this._v.y*.5+.5)*r;const f=Math.abs(this._v.x)<1.08&&Math.abs(this._v.y)<1.08;this._v.set(l.x,.05,l.z).project(e),l.fx=(this._v.x*.5+.5)*s,l.fy=(-this._v.y*.5+.5)*r;const h=l.label;h.name=o.name,h.provider=o.provider,h.tier=o.config.tier,h.model=o.config.model,h.owner=o.owner,h.ownerColor=o.ownerColor??"#9a8ac0",h.skills=o.skills??[],h.phase=o.phase,h.ticketId=o.ticketId,h.cost=o.usage?.costUsd??0,h.burn=o.burnUsdPerMin??0,h.bubble=o.bubble,h.x=l.sx,h.y=l.sy,h.visible=f,h.selected=o.id===this.selected,n.push(h)}this.labels.update(n,this.visual.showLabels,this.visual.showBubbles,this.cam.zoom*(1+this.visual.focus*2.6*(this.selected?1:0))<1.45,this.skills.fn);const a=this.flightTags;a.length=0;for(const o of this.flights.tags)this._v.set(o.x,o.y,o.z).project(e),!(Math.abs(this._v.x)>1.1||Math.abs(this._v.y)>1.1)&&a.push({key:o.key,text:o.text,color:o.color,x:(this._v.x*.5+.5)*s,y:(-this._v.y*.5+.5)*r});this.labels.updateFlights(a)}updatePaths(t,e){let n=0;const s=this.pathPos;for(const a of t.agents){const o=this.entries.get(a.id),l=ex[a.phase];if(!o||!l||a.pose!=="walk"&&a.pose!=="carry_walk")continue;if(o.pathAcc+=e,o.pathAcc>.5||!o.path){o.pathAcc=0;try{o.path=Pf({point:{x:a.pos.x,z:a.pos.z}},l(a))}catch{o.path=null}}const c=o.path;if(!c)continue;let f=o.x,h=o.z;for(let u=0;u<c.length&&n<639;u++)s[n*6]=f,s[n*6+1]=.12,s[n*6+2]=h,s[n*6+3]=c[u].x,s[n*6+4]=.12,s[n*6+5]=c[u].z,f=c[u].x,h=c[u].z,n++}const r=this.pathLines.geometry;r.setDrawRange(0,n*2),r.attributes.position.needsUpdate=!0}}export{sx as OfficeScene};
