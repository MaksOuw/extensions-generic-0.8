import moment from 'moment'

export function convertDate(dateString: string): Date {
    const match = dateString.match(/il y a\s+(\d+)\s+(\w+)/i)
    if (!match) {
        console.log('Failed to parse chapter date! TO DEV: Please check if the entered months reflect the sites months')
        return new Date()
    }

    const amount = parseInt(match[1], 10)
    const unit = match[2].toLowerCase()

    const unitMap: Record<string, moment.unitOfTime.DurationConstructor> = {
        'sem': 'weeks',
        'semaine': 'weeks', 'semaines': 'weeks',
        'jour': 'days', 'jours': 'days', 'j': 'days',
        'heure': 'hours', 'heures': 'hours', 'h': 'hours',
        'minute': 'minutes', 'minutes': 'minutes',
        'seconde': 'seconds', 'secondes': 'seconds', 'sec': 'seconds',
        'mois': 'months',
        'an': 'years', 'ans': 'years', 'année': 'years', 'années': 'years'
    }

    const mappedUnit = unitMap[unit]
    if (!mappedUnit) {
        console.log(`Unknown time unit: "${unit}" in date string: "${dateString}"`)
        return new Date()
    }

    return moment().subtract(amount, mappedUnit).toDate()
}
