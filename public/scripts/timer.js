// Timer logic
// public/scripts/timer.js

export class FocusTimer {
  constructor({ onTick, onComplete }) {
    this.onTick = onTick || (() => {});
    this.onComplete = onComplete || (() => {});
    this.durationSeconds = 25 * 60;
    this.remainingSeconds = this.durationSeconds;
    this.intervalId = null;
    this.isRunning = false;
    this.currentPlanId = null;

    this._emitTick();
  }

  setPlan(planId) {
    this.currentPlanId = planId || null;
  }

  setDurationMinutes(minutes) {
    const m = Number(minutes) || 25;
    this.durationSeconds = m * 60;
    if (!this.isRunning) {
      this.remainingSeconds = this.durationSeconds;
      this._emitTick();
    }
  }

  start() {
    if (this.isRunning) return;
    if (this.remainingSeconds <= 0) {
      this.remainingSeconds = this.durationSeconds;
    }

    this.isRunning = true;
    this._tickLoop();
  }

  pause() {
    this.isRunning = false;
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
  }

  reset() {
    this.pause();
    this.remainingSeconds = this.durationSeconds;
    this._emitTick();
  }

  _tickLoop() {
    if (!this.isRunning) return;

    this.intervalId = setTimeout(() => {
      this.remainingSeconds -= 1;

      if (this.remainingSeconds <= 0) {
        this.remainingSeconds = 0;
        this.isRunning = false;
        this._emitTick();

        const planId = this.currentPlanId;
        const durationSeconds = this.durationSeconds;
        this.onComplete(planId, durationSeconds);

        setTimeout(() => {
          this.reset();
        }, 300);
      } else {
        this._emitTick();
        this._tickLoop();
      }
    }, 1000);
  }

  _emitTick() {
    const mins = Math.floor(this.remainingSeconds / 60);
    const secs = this.remainingSeconds % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    this.onTick(formatted);
  }
}