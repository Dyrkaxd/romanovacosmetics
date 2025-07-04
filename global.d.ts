
// This augments the jsPDF type definition to include the autoTable plugin.
// This is necessary because TypeScript doesn't automatically know about
// methods added by plugins.
import 'jspdf';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: {
      finalY?: number;
    };
  }
}
