import { plainStyle } from '../../qr/style';
import { defineTool } from '../types';

export const tool = defineTool({
  address: 'wifi-qr-code',
  name: 'Make a Wi-Fi QR code',
  blurb: 'Guests point their phone camera at it and join your Wi-Fi.',
  category: 'Other',
  position: 2,
  noun: { one: 'Wi-Fi QR code', many: 'Wi-Fi QR codes' },
  // The person fills in the options instead of choosing a file or typing in the box.
  accept: [],
  input: 'none',
  typeBox: false,
  needs: [],
  largeFileLimit: 0,
  startButton: 'Make a Wi-Fi QR code',
  privacyLine: 'What you type stays on your device.',
  // The network name only, so the picture's description never reads out the password.
  textFor: (options) => ({ pictureLabel: `Wi-Fi QR code for ${options.name}` }),
  reasons: {
    tooLong: 'This is too long for one code. Try a shorter name or password.',
    logo: "This logo didn't open. Choose a PNG, JPG, WebP or SVG.",
  },
  notes: {
    name: 'Network name',
    password: 'Password',
    passwordHint: 'Leave it empty if your Wi-Fi has no password.',
  },
  worker: false,
  outsideAddresses: [],
  defaultOptions: { name: '', password: '', style: plainStyle },
});
