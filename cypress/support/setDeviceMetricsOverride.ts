/**
 * Uses the Chrome DevTools Protocol emulation domain to set the device metrics.
 * @see https://chromedevtools.github.io/devtools-protocol/tot/Emulation/#method-setDeviceMetricsOverride
 */

import { fireCdpCommand } from "./utils/fireCdpCommand";

export interface SetDeviceMetricsOverrideOptions {
  deviceScaleFactor: number;
  width: number;
  height: number;
}

export async function setDeviceMetricsOverride({
  width,
  height,
  deviceScaleFactor,
}: SetDeviceMetricsOverrideOptions) {
   await fireCdpCommand("Emulation.setDeviceMetricsOverride", {
    width: width * deviceScaleFactor,
    height: height * deviceScaleFactor,
    mobile: false,
    deviceScaleFactor: deviceScaleFactor,
  });
}
