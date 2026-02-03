/**
 * TypeScript типы для crypto-pro-cadesplugin
 */

declare module 'crypto-pro-cadesplugin' {
  export interface CertificateInfo {
    thumbprint: string;
    subjectInfo: string;
    issuerInfo: string;
    validPeriod: {
      from: Date;
      to: Date;
    };
    friendlySubjectInfo(): Array<{ value: string; text: string }>;
    friendlyIssuerInfo(): Array<{ value: string; text: string }>;
    friendlyValidPeriod(): {
      from: { ddmmyy: string; hhmmss: string };
      to: { ddmmyy: string; hhmmss: string };
    };
    isValid(): boolean;
  }

  export interface CryptoProApi {
    about(): Promise<string>;
    getCertsList(): Promise<CertificateInfo[]>;
    getCert(thumbprint: string): Promise<CertificateInfo>;
    currentCadesCert(thumbprint: string): Promise<any>;
    signBase64(thumbprint: string, base64: string, detached?: boolean): Promise<string>;
    signXml(thumbprint: string, xml: string, signatureType?: number): Promise<string>;
  }

  const cadesplugin: () => Promise<CryptoProApi>;
  export default cadesplugin;
}
