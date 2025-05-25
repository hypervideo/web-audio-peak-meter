Fork of https://github.com/esonderegger/web-audio-peak-meter that only includes peak metering and corresponding audio worklets.

------

# Web Audio Peak Meters

Customizable peak meters, using the web audio API. It can measure peak or true peak based on [ITU-R BS.1770](https://www.itu.int/rec/R-REC-BS.1770)

## Usage (basic)

To use these meters, first create a `<div>` with a width and height and an `<audio>` element:

```html
<audio id="my-audio" preload="metadata" controls="controls">
  <source src="audio/marines_hymn.mp3" type="audio/mpeg" />
</audio>
```

Then, at the bottom of your `<body>` tag, add the script tag for these meters. I recommend copying the latest `web-audio-peak-meter-<version>.min.js` file from the `docs` directory and self-hosting it, or installing via [npm](https://www.npmjs.com/package/web-audio-peak-meter) and bundling it with your application. Next, create an `AudioContext` if you don't have one already and create an [AudioNode](https://developer.mozilla.org/en-US/docs/Web/API/AudioNode) from the `<audio>` element, connecting it to the destination node. Finally, create a meter node and call the `createMeter` function, passing in the Element object, the meter node, and an optional object for configuration options, like so:

```html
<script>
  const myAudio = document.getElementById('my-audio');
  const audioCtx = new window.AudioContext();
  const sourceNode = audioCtx.createMediaElementSource(myAudio);
  sourceNode.connect(audioCtx.destination);
  this.meter = new WebAudioPeakMeter(
      sourceNode,
      (volume) => {
          console.log(`Current volume: ${volume.toFixed(2)}`);
      },
      {
          audioMeterStandard: "peak-sample",
          // 10 times per second
          peakCallbackDelay: 1000 / 10,
          // Optional, map dB values to a normalized range
          peakCallbackNormalizeVolume: {
              dbRangeMin: -48,
              dbRangeMax: 0,
              normalizedRangeMin: 0,
              normalizedRangeMax: 100,
          },
      },
  );
</script>
```

## Options

The following options options are supported (the third parameter of the constructor)

- audioMeterStandard (string): Can be either `peak-sample`, or `true-peak` (default: `peak-sample`)
- peakHoldDuration (number): the number, in milliseconds, to hold the peak value before resetting (default: `0`, meaning never reset)

## Frequently encountered problems

### The AudioContext was not allowed to start

In an effort to prevent unwanted auto-playing audio, some browsers do not allow the web audio API's `AudioContext` to start when it is first created. It must be started by calling `resume()` on the context after the user interacts with the page. Different browsers implement this requirement differently, however:

- Chrome: `AudioContext` is initially paused. Can be resumed by either a callback attached to a click event or by adding a listener to an audio/video element's `play` event. ([more information](https://developer.chrome.com/blog/autoplay/#webaudio))
- Firefox: `AudioContext` is initially running
- Webkit/Safari: `AudioContext` is initially paused. Can be resumed only by a callback attached to a click event - listening for `play` events on HTML media elements does not work.

### MediaElementAudioSource outputs zeroes due to CORS access restrictions

If using `<audio>` or `<video>` elements and the source media is not on the same domain as the web site, the server serving the media must add an `access-control-allow-origin` header with the domain of the web site to the response. ([more information](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/crossorigin))

## Local Development

The minified javascript is built using rollup. There's no difference (for now) between the development version and the production version. To start a local server for debugging, run:

```
npm ci
npm run start
```

And open a browser to [http://localhost:6080/web-audio-peak-meter/index.html](http://localhost:6080/web-audio-peak-meter/index.html) to see a local version of the docs page.

## Copyright and license

Code and documentation copyright 2016 [Evan Sonderegger](https://rpy.xyz) and released under the [MIT License](https://github.com/esonderegger/web-audio-peak-meter/blob/master/LICENSE).
