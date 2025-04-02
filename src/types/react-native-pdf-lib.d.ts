declare module 'react-native-pdf-lib' {
  export interface PDFDocument {
    addPage: (dimensions: [number, number]) => PDFPage;
    embedFont: (fontName: string) => Promise<any>;
    save: () => Promise<Uint8Array>;
  }

  export interface PDFPage {
    drawText: (text: string, options: {
      x: number;
      y: number;
      size: number;
      font: any;
    }) => void;
  }

  export const PDFDocument: {
    create: () => Promise<PDFDocument>;
  };

  export const StandardFonts: {
    Helvetica: string;
    [key: string]: string;
  };
} 