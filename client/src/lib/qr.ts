import QRCode from "qrcode";

/** A scannable version of a share link, generated on the device. */
export async function qrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 256,
    color: { dark: "#05070fff", light: "#ffffffff" },
  });
}
