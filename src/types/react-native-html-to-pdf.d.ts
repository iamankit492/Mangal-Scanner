declare module 'react-native-html-to-pdf' {
  interface PDFOptions {
    html: string;
    fileName?: string;
    directory?: string;
    base64?: boolean;
    height?: number;
    width?: number;
    paddingLeft?: number;
    paddingRight?: number;
    paddingTop?: number;
    paddingBottom?: number;
  }

  interface PDFResult {
    filePath: string;
    base64?: string;
  }

  export function convert(options: PDFOptions): Promise<PDFResult>;

  const RNHTMLtoPDF: {
    convert: typeof convert;
  };

  export default RNHTMLtoPDF;
} 