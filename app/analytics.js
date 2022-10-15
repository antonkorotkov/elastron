const { app } = require('electron')
const ua = require('universal-analytics')
const { v4: uuid } = require('uuid')
const { JSONStorage } = require('node-localstorage')

const nodeStorage = new JSONStorage(app.getPath('userData'))

// Retrieve the userid value, and if it's not there, assign it a new uuid.
const userId = nodeStorage.getItem('userid') || uuid()

// (re)save the userid, so it persists for the next app session.
nodeStorage.setItem('userid', userId)

const gId =
  process.env.ENV === 'development' ? 'UA-165047740-2' : 'UA-165047740-1'

const usr = ua(gId, userId)

const trackEvent = (category, action, label, value) => {
  usr
    .event({
      ec: category,
      ea: action,
      el: label,
      ev: value,
    })
    .send()
}

module.exports = { trackEvent }
