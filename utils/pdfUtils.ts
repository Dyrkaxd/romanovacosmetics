import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { robotoRegularNormal } from '../assets/Roboto-Regular-normal';
import type { Order, Customer, OrderItem } from '../types';

// Extend jsPDF with the autoTable method
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

// Function to add the font to jsPDF instance
const addRobotoFont = (doc: jsPDF) => {
    // Add the font to jsPDF
    doc.addFileToVFS('Roboto-Regular.ttf', robotoRegularNormal);
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
    doc.setFont('Roboto');
};

const drawHeader = (doc: jsPDF, title: string) => {
    doc.setFontSize(22);
    doc.setTextColor(34, 34, 34);
    doc.text('ROMANOVA Cosmetics', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('вул. Торгова 1, м. Київ, 01001', 14, 28);
    doc.text('samsonenkoroma@gmail.com', 14, 33);
    
    doc.setFontSize(26);
    doc.setTextColor(17, 24, 39);
    doc.text(title, doc.internal.pageSize.getWidth() - 14, 22, { align: 'right' });

    doc.setLineWidth(0.5);
    doc.line(14, 40, doc.internal.pageSize.getWidth() - 14, 40);
};

const drawFooter = (doc: jsPDF) => {
    const pageCount = (doc.internal as any).getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Сторінка ${i} з ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
    }
};

export const generateInvoicePdf = async (order: Order, customer: Customer) => {
    const doc = new jsPDF();
    addRobotoFont(doc);

    drawHeader(doc, 'Рахунок-фактура');

    // Customer info
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('ВИСТАВЛЕНО ДЛЯ:', 14, 48);
    doc.setFontSize(12);
    doc.setTextColor(34, 34, 34);
    doc.text(customer?.name || order.customerName, 14, 54);
    if(customer?.address?.street) doc.text(customer.address.street, 14, 60);
    if(customer?.address?.city) doc.text(`${customer.address.city}, ${customer.address.state || ''} ${customer.address.zip || ''}`.trim(), 14, 66);
    if(customer?.email) doc.text(customer.email, 14, 72);
    
    // Order info
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('Номер рахунку:', doc.internal.pageSize.getWidth() - 55, 48);
    doc.text('Дата рахунку:', doc.internal.pageSize.getWidth() - 55, 54);
    doc.setFontSize(12);
    doc.setTextColor(34, 34, 34);
    doc.text(`#${order.id.substring(0, 8)}`, doc.internal.pageSize.getWidth() - 14, 48, { align: 'right' });
    doc.text(new Date(order.date).toLocaleDateString('uk-UA'), doc.internal.pageSize.getWidth() - 14, 54, { align: 'right' });

    const tableData = order.items.map((item, index) => [
        index + 1,
        item.productName,
        item.quantity,
        `₴${item.price.toFixed(2)}`,
        `${item.discount || 0}%`,
        `₴${(item.quantity * item.price * (1 - (item.discount || 0) / 100)).toFixed(2)}`
    ]);

    doc.autoTable({
        startY: 80,
        head: [['#', 'Товар', 'К-сть', 'Ціна', 'Знижка', 'Всього']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [225, 29, 72], font: 'Roboto', fontStyle: 'normal' },
        bodyStyles: { font: 'Roboto', fontStyle: 'normal' },
    });

    const finalY = (doc as any).lastAutoTable.finalY;
    const subtotal = order.items.reduce((acc, item) => acc + item.quantity * item.price, 0);
    const totalDiscount = subtotal - order.totalAmount;

    doc.setFontSize(10);
    doc.text('Проміжна сума:', doc.internal.pageSize.getWidth() - 60, finalY + 15, { align: 'right' });
    doc.text(`₴${subtotal.toFixed(2)}`, doc.internal.pageSize.getWidth() - 14, finalY + 15, { align: 'right' });
    doc.text('Знижка:', doc.internal.pageSize.getWidth() - 60, finalY + 21, { align: 'right' });
    doc.text(`-₴${totalDiscount.toFixed(2)}`, doc.internal.pageSize.getWidth() - 14, finalY + 21, { align: 'right' });
    doc.setLineWidth(0.2);
    doc.line(doc.internal.pageSize.getWidth() - 60, finalY + 24, doc.internal.pageSize.getWidth() - 14, finalY + 24);
    
    doc.setFontSize(12);
    doc.setFont('Roboto', 'normal'); // Set font to normal
    doc.text('Разом до сплати:', doc.internal.pageSize.getWidth() - 60, finalY + 30, { align: 'right' });
    doc.setFontSize(16);
    doc.text(`₴${order.totalAmount.toFixed(2)}`, doc.internal.pageSize.getWidth() - 14, finalY + 30, { align: 'right' });
    
    drawFooter(doc);
    doc.save(`Invoice_${order.id.substring(0, 8)}.pdf`);
};

export const generateBillOfLadingPdf = async (order: Order, customer: Customer) => {
    const doc = new jsPDF();
    addRobotoFont(doc);

    drawHeader(doc, 'ТТН');
    
    doc.setFontSize(10);
    // Shipper
    doc.text('ВАНТАЖОВІДПРАВНИК:', 14, 48);
    doc.setFontSize(11);
    doc.text('ROMANOVA Cosmetics', 14, 54);
    doc.text('вул. Торгова 1, м. Київ, 01001', 14, 60);

    // Consignee
    doc.setFontSize(10);
    doc.text('ВАНТАЖООДЕРЖУВАЧ:', doc.internal.pageSize.getWidth() - 14, 48, { align: 'right' });
    doc.setFontSize(11);
    doc.text(customer.name, doc.internal.pageSize.getWidth() - 14, 54, { align: 'right' });
    const address = `${customer.address.city}, ${customer.address.street}`;
    doc.text(address, doc.internal.pageSize.getWidth() - 14, 60, { align: 'right' });

    doc.setLineWidth(0.2);
    doc.line(14, 70, doc.internal.pageSize.getWidth() - 14, 70);

    const tableData = order.items.map((item, index) => [
        index + 1,
        item.productName,
        item.quantity,
    ]);

    doc.autoTable({
        startY: 75,
        head: [['#', 'Найменування вантажу', 'Кількість місць']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [80, 80, 80], font: 'Roboto', fontStyle: 'normal' },
        bodyStyles: { font: 'Roboto', fontStyle: 'normal' },
    });

    const finalY = (doc as any).lastAutoTable.finalY;
    
    doc.setFontSize(10);
    doc.text('Всього місць:', 14, finalY + 10);
    doc.setFontSize(11);
    doc.text(order.items.reduce((sum, item) => sum + item.quantity, 0).toString(), 40, finalY + 10);

    doc.text('Підпис відправника: _______________', 14, finalY + 30);
    doc.text('Підпис одержувача: _______________', doc.internal.pageSize.getWidth() - 14, finalY + 30, { align: 'right' });

    drawFooter(doc);
    doc.save(`BillOfLading_${order.id.substring(0, 8)}.pdf`);
};