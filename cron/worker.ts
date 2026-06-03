import processQueue from './actions/processQueue';

class CronWorker {
  private running = false;
  private readonly intervalId: NodeJS.Timeout;

  constructor(private readonly interval = 1000) {
    this.intervalId = setInterval(() => this.run(), interval);
  }

  async run() {
    if (this.running) return;
    this.running = true;
    try {
      await processQueue();
    } catch (error) {
      console.error('worker loop failed', error);
    } finally {
      this.running = false;
    }
  }
}

new CronWorker();
console.log('Qwen UI worker started');
