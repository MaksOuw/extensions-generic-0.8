import { Months } from './MangaStreamInterfaces'

export function convertDate(dateString: string, source: any): Date {
    // Parsed date string
    dateString = dateString.toLowerCase()

    // Month formats provided by the source
    const dateMonths: Months = source.dateMonths

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

    let date: Date | null = null
    Object.entries(dateMonths).forEach(([key, value]) => {
        if (dateString.toLowerCase().includes(value?.toLowerCase())) {
            date = new Date(dateString.replace(value, key ?? ''))
        }
    })

    console.log('Date : ' + String(date))
    console.log('Date : ' + dateString)

    if (!date || String(date) == 'Invalid Date') {
        console.log('Failed to parse chapter date! TO DEV: Please check if the entered months reflect the sites months')
        return new Date()
    }
    return date
}