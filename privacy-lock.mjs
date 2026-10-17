/* Luna V14: privacy shield and inactivity lock. No personal data or timers are persisted. */
export const FOREGROUND_IDLE_MS = 10 * 60 * 1000;
export const BACKGROUND_LOCK_MS = 5 * 60 * 1000;

export class PrivacyLock {
 constructor({onShield,onUnshield,onLock,now=()=>Date.now(),schedule=(fn,ms)=>setTimeout(fn,ms),cancel=id=>clearTimeout(id),idleMs=FOREGROUND_IDLE_MS,backgroundMs=BACKGROUND_LOCK_MS}) {
  if(typeof onShield!=='function'||typeof onUnshield!=='function'||typeof onLock!=='function'||idleMs<=0||backgroundMs<=0)throw Error('Ungültige Privatsphäre-Einstellungen.');
  Object.assign(this,{onShield,onUnshield,onLock,now,schedule,cancel,idleMs,backgroundMs});
  this.active=false;this.hiddenSince=null;this.lastActivity=0;this.timer=null;
 }
 cancelTimer(){if(this.timer!==null){this.cancel(this.timer);this.timer=null;}}
 start(){if(this.active)return;this.active=true;this.hiddenSince=null;this.lastActivity=this.now();this.onUnshield();this.scheduleIdle();}
 stop(){this.active=false;this.hiddenSince=null;this.cancelTimer();this.onUnshield();}
 activity(){if(!this.active||this.hiddenSince!==null)return;this.lastActivity=this.now();this.scheduleIdle();}
 scheduleIdle(){
  this.cancelTimer();if(!this.active||this.hiddenSince!==null)return;
  const remaining=this.idleMs-(this.now()-this.lastActivity);
  if(remaining<=0){this.lock();return;}
  this.timer=this.schedule(()=>{this.timer=null;this.scheduleIdle();},remaining);
 }
 hide(){
  if(!this.active||this.hiddenSince!==null)return;
  this.hiddenSince=this.now();this.onShield();this.scheduleBackground();
 }
 scheduleBackground(){
  this.cancelTimer();if(!this.active||this.hiddenSince===null)return;
  const remaining=this.backgroundMs-(this.now()-this.hiddenSince);
  if(remaining<=0){this.lock();return;}
  this.timer=this.schedule(()=>{this.timer=null;this.scheduleBackground();},remaining);
 }
 show(){
  if(!this.active||this.hiddenSince===null)return;
  const elapsed=this.now()-this.hiddenSince;this.hiddenSince=null;this.cancelTimer();
  if(elapsed>=this.backgroundMs){this.lock();return;}
  this.lastActivity=this.now();this.onUnshield();this.scheduleIdle();
 }
 lock(){
  if(!this.active)return;
  this.active=false;this.cancelTimer();this.onShield();this.onLock();
 }
}
