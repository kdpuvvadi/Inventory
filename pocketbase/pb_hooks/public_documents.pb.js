/// <reference path="../pb_data/types.d.ts" />

/**
 * Public document share endpoint.
 * GET /api/public/documents/{token}
 */
routerAdd('GET', '/api/public/documents/{token}', (e) => {
  const token = e.request.pathValue('token')
  if (!token) {
    return e.json(400, { message: 'Share token is required' })
  }

  let doc
  try {
    doc = $app.findFirstRecordByFilter(
      'documents',
      'share_token = {:token}',
      { token: token },
    )
  } catch (err) {
    return e.json(404, { message: 'Document not found' })
  }

  function fileUrl(record, filename) {
    if (!filename) return null
    try {
      return e.app.settings().meta.appURL
        ? e.app.settings().meta.appURL.replace(/\/$/, '') +
            '/api/files/' +
            record.collection().id +
            '/' +
            record.id +
            '/' +
            encodeURIComponent(filename)
        : '/api/files/' +
            record.collection().id +
            '/' +
            record.id +
            '/' +
            encodeURIComponent(filename)
    } catch (_) {
      return (
        '/api/files/' +
        record.collection().id +
        '/' +
        record.id +
        '/' +
        encodeURIComponent(filename)
      )
    }
  }

  let customer = null
  const customerId = doc.getString('customer')
  if (customerId) {
    try {
      const customerRec = $app.findRecordById('customers', customerId)
      customer = {
        id: customerRec.id,
        name: customerRec.getString('name'),
        contact_person: customerRec.getString('contact_person'),
        email: customerRec.getString('email'),
        phone: customerRec.getString('phone'),
        address: customerRec.getString('address'),
        state: customerRec.getString('state'),
        pincode: customerRec.getString('pincode'),
      }
    } catch (_) {
      customer = null
    }
  }

  const items = []
  try {
    const itemRecords = $app.findRecordsByFilter(
      'document_items',
      'document = {:docId}',
      'created',
      500,
      0,
      { docId: doc.id },
    )
    for (const item of itemRecords) {
      items.push({
        id: item.id,
        description: item.getString('description'),
        part_number: item.getString('part_number'),
        hsn_code: item.getString('hsn_code'),
        quantity: item.getFloat('quantity'),
        unit_price: item.getFloat('unit_price'),
        discount_percent: item.getFloat('discount_percent'),
        line_total: item.getFloat('line_total'),
      })
    }
  } catch (_) {
    // leave items empty
  }

  let settings = null
  try {
    const settingsList = $app.findRecordsByFilter(
      'app_settings',
      'id != ""',
      '-created',
      1,
      0,
    )
    if (settingsList.length > 0) {
      const s = settingsList[0]
      settings = {
        company_name: s.getString('company_name'),
        company_address: s.getString('company_address'),
        company_state: s.getString('company_state'),
        company_pincode: s.getString('company_pincode'),
        company_email: s.getString('company_email'),
        company_phone: s.getString('company_phone'),
        gst_number: s.getString('gst_number'),
        currency: s.getString('currency'),
        header_show_logo: s.getBool('header_show_logo'),
        header_show_address: s.getBool('header_show_address'),
        header_show_email: s.getBool('header_show_email'),
        header_show_phone: s.getBool('header_show_phone'),
        header_show_gst: s.getBool('header_show_gst'),
        company_logo_url: fileUrl(s, s.getString('company_logo')),
      }
    }
  } catch (_) {
    settings = null
  }

  return e.json(200, {
    document: {
      id: doc.id,
      document_number: doc.getString('document_number'),
      type: doc.getString('type'),
      status: doc.getString('status'),
      issue_date: doc.getString('issue_date'),
      due_date: doc.getString('due_date'),
      currency: doc.getString('currency'),
      discount_percent: doc.getFloat('discount_percent'),
      tax_percent: doc.getFloat('tax_percent'),
      subtotal: doc.getFloat('subtotal'),
      discount_amount: doc.getFloat('discount_amount'),
      tax_amount: doc.getFloat('tax_amount'),
      total: doc.getFloat('total'),
      billing_address: doc.getString('billing_address'),
      billing_state: doc.getString('billing_state'),
      billing_pincode: doc.getString('billing_pincode'),
      gst_type: doc.getString('gst_type'),
      reference: doc.getString('reference'),
      notes: doc.getString('notes'),
    },
    items: items,
    customer: customer,
    settings: settings,
  })
})
