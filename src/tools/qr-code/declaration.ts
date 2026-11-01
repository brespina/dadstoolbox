import { plainStyle } from '../../qr/style';
import { defineTool } from '../types';

export const tool = defineTool({
  address: 'qr-code',
  name: 'Make a QR code',
  blurb: 'Type text or a web address and get a code a phone camera can read.',
  category: 'Other',
  position: 1,
  noun: { one: 'QR code', many: 'QR codes' },
  // The person types instead of choosing a file, so there is no Choose or start button.
  accept: [],
  input: 'none',
  typeLabel: 'Text or web address',
  needs: [],
  largeFileLimit: 0,
  startButton: 'Make a QR code',
  privacyLine: 'What you type stays on your device.',
  reasons: {
    tooLong: 'This is too long for one code. Try a shorter text.',
    logo: "This logo didn't open. Choose a PNG, JPG, WebP or SVG.",
  },
  worker: false,
  outsideAddresses: [],
  defaultOptions: { style: plainStyle },
});
