var moment = require('moment')

export function convertDate(dateString: string): Date {
    // Parsed date string
    dateString = dateString.toLowerCase()

    const now = new Date();
    const regex = /^(\d+)\s+(second|minute|hour|day)s?\s+ago$/i

    const match = dateString.match(regex)
    if (match) {
        const value = parseInt(match[1], 10)
        const unit = match[2].toLowerCase()

        switch (unit) {
            case "second":
                dateString = now.getTime() - value * 1000
            case "minute":
                dateString = now.getTime() - value * 60 * 1000
            case "hour":
                dateString = now.getTime() - value * 60 * 60 * 1000
            case "day":
                dateString = now.getTime() - value * 24 * 60 * 60 * 1000
        }
    }

    let date = moment(dateString)

    if (!date || String(date) == 'Invalid Date') {
        console.log('Failed to parse chapter date! TO DEV: Please check if the entered months reflect the sites months')
        return new Date()
    }

    return date.toDate()
}