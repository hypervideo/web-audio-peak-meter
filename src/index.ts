import { PeakMeterConfig, defaultConfig } from './config';
import { dbFromFloat } from './utils';
import peakSampleProcessor from './peak-sample-processor.txt';
import truePeakProcessor from './true-peak-processor.txt';

export class WebAudioPeakMeter {
  channelCount: number;
  srcNode: AudioNode;
  node?: AudioWorkletNode;
  config: PeakMeterConfig;
  tempPeaks: Array<number>;
  heldPeaks: Array<number>;
  peakHoldTimeouts: Array<number>;
  animationRequestId?: number;

  constructor(src: AudioNode, options = {}) {
    this.srcNode = src;
    this.config = Object.assign({ ...defaultConfig }, options);
    this.channelCount = src.channelCount;
    this.tempPeaks = new Array(this.channelCount).fill(0.0);
    this.heldPeaks = new Array(this.channelCount).fill(0.0);
    this.peakHoldTimeouts = new Array(this.channelCount).fill(0);
    this.initNode();
  }

  private async initNode() {
    const { audioMeterStandard } = this.config;
    try {
      this.node = new AudioWorkletNode(this.srcNode.context, `${audioMeterStandard}-processor`, {
        parameterData: {},
      });
    } catch (err) {
      const workletString =
        audioMeterStandard === 'true-peak' ? truePeakProcessor : peakSampleProcessor;
      const blob = new Blob([workletString], { type: 'application/javascript' });
      const objectURL = URL.createObjectURL(blob);
      await this.srcNode.context.audioWorklet.addModule(objectURL);
      this.node = new AudioWorkletNode(this.srcNode.context, `${audioMeterStandard}-processor`, {
        parameterData: {},
      });
    }
    this.node.port.onmessage = (ev: MessageEvent) => this.handleNodePortMessage(ev);
    this.srcNode.connect(this.node).connect(this.srcNode.context.destination);
  }

  private handleNodePortMessage(ev: MessageEvent) {
    if (ev.data.type === 'message') {
      console.log(ev.data.message);
    }
    if (ev.data.type === 'peaks') {
      const { peaks } = ev.data;
      for (let i = 0; i < this.tempPeaks.length; i += 1) {
        if (peaks.length > i) {
          this.tempPeaks[i] = peaks[i];
        } else {
          this.tempPeaks[i] = 0.0;
        }
      }
      if (peaks.length < this.channelCount) {
        this.tempPeaks.fill(0.0, peaks.length);
      }
      for (let i = 0; i < peaks.length; i += 1) {
        if (peaks[i] > this.heldPeaks[i]) {
          this.heldPeaks[i] = peaks[i];
          if (this.peakHoldTimeouts[i]) {
            clearTimeout(this.peakHoldTimeouts[i]);
          }
          if (this.config.peakHoldDuration) {
            this.peakHoldTimeouts[i] = window.setTimeout(() => {
              this.clearPeak(i);
            }, this.config.peakHoldDuration);
          }
        }
      }
    }
  }

  private clearPeak(i: number) {
    this.heldPeaks[i] = this.tempPeaks[i];
  }

  public clearPeaks() {
    for (let i = 0; i < this.heldPeaks.length; i += 1) {
      this.clearPeak(i);
    }
  }

  public getPeaks() {
    return {
      current: this.tempPeaks,
      maxes: this.heldPeaks,
      currentDB: this.tempPeaks.map(dbFromFloat),
      maxesDB: this.heldPeaks.map(dbFromFloat),
    };
  }

  cleanup() {
    if (this.node) {
      this.node.disconnect();
    }
  }
}
