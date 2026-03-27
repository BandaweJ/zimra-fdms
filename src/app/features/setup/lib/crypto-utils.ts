import * as x509 from '@peculiar/x509';

const zimraSubject = 'O=Zimbabwe Revenue Authority, S=Zimbabwe, C=ZW';

function padDeviceId10(deviceID: number): string {
  return String(deviceID).padStart(10, '0');
}

export function getZimraCsrCN(deviceSerialNo: string, deviceID: number): string {
  return `ZIMRA-${deviceSerialNo}-${padDeviceId10(deviceID)}`;
}

export async function generateZimraCsrPem(params: {
  deviceSerialNo: string;
  deviceID: number;
}): Promise<string> {
  const { deviceSerialNo, deviceID } = params;
  const cn = getZimraCsrCN(deviceSerialNo, deviceID);
  const webCrypto = globalThis.crypto;
  if (!webCrypto?.subtle) {
    throw new Error('WebCrypto is not available in this browser context.');
  }

  // ECC ECDSA key pair (secp256r1 / P-256)
  const algorithm = {
    name: 'ECDSA',
    hash: 'SHA-256',
    namedCurve: 'P-256',
  } as const;

  const keys = await webCrypto.subtle.generateKey(algorithm, false, ['sign', 'verify']);

  const certReq = await x509.Pkcs10CertificateRequestGenerator.create({
    name: `CN=${cn}, ${zimraSubject}`,
    keys,
    signingAlgorithm: algorithm,
  });

  return certReq.toString('pem');
}

export function isPemCertificateRequest(pem: string): boolean {
  const v = pem.trim();
  return (
    v.includes('-----BEGIN CERTIFICATE REQUEST-----') &&
    v.includes('-----END CERTIFICATE REQUEST-----')
  );
}

export function tryParseCsrPem(pem: string): { ok: true } | { ok: false; error: string } {
  if (!isPemCertificateRequest(pem)) return { ok: false, error: 'Not a valid PEM certificate request.' };
  try {
    // Constructor throws on invalid PEM/ASN.1.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // @ts-ignore - Peculiar typings accept AsnEncodedType (PEM string).
    new x509.Pkcs10CertificateRequest(pem);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Invalid CSR format.';
    return { ok: false, error: msg };
  }
}

export function parseCertificateValidity(pem: string): { validFrom: Date; validTill: Date } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cert = new (x509 as any).X509Certificate(pem) as x509.X509Certificate;
  return { validFrom: cert.notBefore, validTill: cert.notAfter };
}

