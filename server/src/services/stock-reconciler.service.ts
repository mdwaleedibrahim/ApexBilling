/**
 * stock-reconciler.service.ts — uses node:sqlite (Node 22+ built-in)
 */
import { getDb, withTransaction } from '../db/database.js'

export function reconcileStockOnEdit(
  documentId: string,
  newItems: Array<{ productId: string; quantity: number }>
): void {
  withTransaction(() => {
    const db = getDb()
    const oldItems = db.prepare(
      `SELECT product_id, quantity FROM document_items WHERE document_id = ?`
    ).all(documentId) as Array<{ product_id: string; quantity: number }>

    for (const old of oldItems) {
      if (!old.product_id) continue
      db.prepare(`UPDATE products SET stock_qty = stock_qty + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .run(old.quantity, old.product_id)
    }

    for (const item of newItems) {
      if (!item.productId) continue
      const product = db.prepare(`SELECT stock_qty, name FROM products WHERE id = ?`)
        .get(item.productId) as { stock_qty: number; name: string } | undefined
      if (!product) continue
      if (product.stock_qty < item.quantity) {
        throw new Error(`Insufficient stock for "${product.name}": available ${product.stock_qty}, requested ${item.quantity}`)
      }
      db.prepare(`UPDATE products SET stock_qty = stock_qty - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .run(item.quantity, item.productId)
    }
  })
}

export function deductStockForNewInvoice(
  items: Array<{ productId?: string; quantity: number; productName: string }>
): void {
  withTransaction(() => {
    const db = getDb()
    for (const item of items) {
      if (!item.productId) continue
      const product = db.prepare(`SELECT stock_qty, name FROM products WHERE id = ?`)
        .get(item.productId) as { stock_qty: number; name: string } | undefined
      if (!product) continue
      if (product.stock_qty < item.quantity) {
        throw new Error(`Insufficient stock for "${product.name}": available ${product.stock_qty}, requested ${item.quantity}`)
      }
      db.prepare(`UPDATE products SET stock_qty = stock_qty - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .run(item.quantity, item.productId)
    }
  })
}

export function restoreStockOnCancel(documentId: string): void {
  withTransaction(() => {
    const db = getDb()
    const items = db.prepare(`SELECT product_id, quantity FROM document_items WHERE document_id = ?`)
      .all(documentId) as Array<{ product_id: string; quantity: number }>
    for (const item of items) {
      if (!item.product_id) continue
      db.prepare(`UPDATE products SET stock_qty = stock_qty + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .run(item.quantity, item.product_id)
    }
  })
}
