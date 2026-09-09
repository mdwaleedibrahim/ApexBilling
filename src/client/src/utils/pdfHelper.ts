// utils/pdfHelper.ts — Generate A4 PDF from an HTML element
// @ts-ignore
import html2pdf from 'html2pdf.js'

export async function generateInvoicePdfBlob(element: HTMLElement, filename: string): Promise<Blob> {
  const opt = {
    margin: [0, 0, 0, 0],
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  }

  // @ts-ignore
  const worker = html2pdf().set(opt).from(element)
  const pdfBlob: Blob = await worker.outputPdf('blob')
  return pdfBlob
}

export async function downloadInvoicePdf(element: HTMLElement, filename: string): Promise<void> {
  const opt = {
    margin: [0, 0, 0, 0],
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  }

  // @ts-ignore
  await html2pdf().set(opt).from(element).save()
}
