import { drawQr, TooLongForCode } from '../../qr/draw';
import { ToolFailure, type ToolTextRun } from '../types';
import { tool } from './declaration';

/** Puts a backslash before each character the Wi-Fi code format uses itself. */
const escape = (value: string) => value.replace(/([\\;,:"])/g, '\\$1');

/**
 * The text phone cameras read as a Wi-Fi network: WPA with a password, open without.
 * The Tool has no type box, so `run` takes everything from the options.
 */
function wifiText({ name, password }: typeof tool.defaultOptions) {
  if (password === '') return `WIFI:T:nopass;S:${escape(name)};;`;
  return `WIFI:T:WPA;S:${escape(name)};P:${escape(password)};;`;
}

/** One QR code that joins the network, in the chosen Style, once it has a name. */
export const run: ToolTextRun<typeof tool.defaultOptions> = async (_typed, options) => {
  if (options.name.trim() === '') return [];
  try {
    return [drawQr(wifiText(options), options.style)];
  } catch (error) {
    if (error instanceof TooLongForCode) throw new ToolFailure(tool.reasons.tooLong!);
    throw error;
  }
};
