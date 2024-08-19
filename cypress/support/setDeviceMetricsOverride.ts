/**
 * Uses the Chrome DevTools Protocol emulation domain to set the device metrics.
 * @see https://chromedevtools.github.io/devtools-protocol/tot/Emulation/#method-setDeviceMetricsOverride
 */

import { fireCdpCommand } from "./fireCdpCommand";

export interface SetDeviceMetricsOverrideOptions {
  deviceScaleFactor?: number;
  width?: number;
  height?: number;
  mobile?: boolean
}

const defaultOptions = {
  deviceScaleFactor: 1,
  width: window.top!.screen.availWidth,
  height: window.top!.screen.availHeight,
  mobile: false,
}

export async function setDeviceMetricsOverride({
  width,
  height,
  mobile,
  deviceScaleFactor,
}: SetDeviceMetricsOverrideOptions = {}): Promise<void> {
  return await fireCdpCommand("Emulation.setDeviceMetricsOverride", {
    width: width ?? defaultOptions.width,
    height: height ?? defaultOptions.height,
    mobile: mobile ?? defaultOptions.mobile,
    deviceScaleFactor: deviceScaleFactor ?? defaultOptions.deviceScaleFactor,
  });
}
