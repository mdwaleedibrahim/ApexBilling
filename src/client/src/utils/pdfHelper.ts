// utils/pdfHelper.ts — Generate A4 PDF from an HTML element
// @ts-ignore
import html2pdf from 'html2pdf.js'

function cleanupBlankTrailingPage(worker: any) {
  return worker.toPdf().get('pdf').then((pdf: any) => {
    try {
      const totalPages = pdf.internal.getNumberOfPages()
      if (totalPages > 1) {
        const canvas = worker.prop?.canvas
        const pageSize = worker.prop?.pageSize
        if (canvas && pageSize?.inner?.ratio) {
          const pxFullHeight = canvas.height
          const pxPageHeight = Math.floor(canvas.width * pageSize.inner.ratio)
          const remainder = pxFullHeight % pxPageHeight
          // If remainder is very small (less than 60px on scale-2 canvas, representing < 8mm of empty subpixel overflow),
          // remove the superfluous trailing blank page.
          if (remainder > 0 && remainder < 60) {
            pdf.deletePage(totalPages)
          }
        }
      }
    } catch (e) {
      console.warn('Could not inspect PDF pages for trimming:', e)
    }
  })
}

export async function generateInvoicePdfBlob(element: HTMLElement, filename: string): Promise<Blob> {
  const opt = {
    margin: [0, 0, 0, 0],
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false, scrollY: 0, scrollX: 0 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'] }
  }

  // @ts-ignore
  let worker = html2pdf().set(opt).from(element)
  worker = cleanupBlankTrailingPage(worker)
  const pdfBlob: Blob = await worker.outputPdf('blob')
  return pdfBlob
}

export async function downloadInvoicePdf(element: HTMLElement, filename: string): Promise<void> {
  const opt = {
    margin: [0, 0, 0, 0],
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false, scrollY: 0, scrollX: 0 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'] }
  }

  // @ts-ignore
  let worker = html2pdf().set(opt).from(element)
  worker = cleanupBlankTrailingPage(worker)
  await worker.save()
}
