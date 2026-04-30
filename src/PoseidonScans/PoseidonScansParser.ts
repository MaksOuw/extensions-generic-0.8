import { Chapter, ChapterDetails, PartialSourceManga, SourceManga, Tag, TagSection } from "@paperback/types"
import { Cheerio, CheerioAPI, load } from "cheerio"
import { decode as decodeHTMLEntity } from 'html-entities'
import { HomeSectionData } from "./PoseidonScansHelpers"
import moment from 'moment'

export class PoseidonScansParser {
    domain = ''
    constructor(domain: string) {
        this.domain = domain
    }

	parseMangaDetails($: CheerioAPI, mangaId: string, source: any): SourceManga {
        const titles: string[] = []
        titles.push(decodeHTMLEntity($('h1.text-4xl').text().trim()))

        const author = $('body > main > div > main > div.min-h-screen.bg-black > div > div.container.mx-auto > div > div.gap-6 > div > div.bg-black.rounded-3xl.py-4.space-y-2 > div > div:nth-child(3) > span.text-white').text().trim()
        const artist = $('body > main > div > main > div.min-h-screen.bg-black > div > div.container.mx-auto > div > div.gap-6 > div > div.bg-black.rounded-3xl.py-4.space-y-2 > div > div:nth-child(4) > span.text-white').text().trim()
        const image = this.getImageSrc($('img.object-cover')).replace('.webp', '.png')
        const description = decodeHTMLEntity($('p.text-gray-300').text().trim())

        const arrayTags: Tag[] = []
        for (const tag of $('a', 'body > main > div > main > div.min-h-screen.bg-black > div > div.container.mx-auto > div > div.gap-6 > div > div.space-y-3 > div').toArray()) {
            const label = $(tag).text().trim()
            const id = this.idCleaner($(tag).attr('href') ?? '')
            if (!id || !label) {
                continue
            }
            arrayTags.push({ id, label })
        }

        const rawStatus = $(`body > main > div > main > div.min-h-screen.bg-black > div > div.container.mx-auto > div > div.gap-6 > div > div.bg-black.rounded-3xl.py-4.space-y-2 > div > div:nth-child(1) > span.px-3.py-1.rounded-full.text-xs`).text().trim()
        let status
        switch (rawStatus.toLowerCase()) {
            case source.manga_StatusTypes.ONGOING.toLowerCase():
                status = 'Ongoing'
                break
            case source.manga_StatusTypes.COMPLETED.toLowerCase():
                status = 'Completed'
                break
            case source.manga_StatusTypes.DROPPED.toLowerCase():
                status = 'Dropped'
                break
            case source.manga_StatusTypes.PAUSED.toLowerCase():
                status = 'Paused'
                break
            default:
                status = 'Ongoing'
                break
        }

        const tagSections: TagSection[] = [
            App.createTagSection({
                id: '0',
                label: 'genres',
                tags: arrayTags.map((x) => App.createTag(x))
            })
        ]

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles,
                image: image,
                status,
                author: author == '' ? 'Unknown' : author,
                artist: artist == '' ? 'Unknown' : artist,
                tags: tagSections,
                desc: description
            })
        })
    }

    parseChapterList(html: string, mangaId: string, source: any): Chapter[] {
        const chapters: Chapter[] = []
        let sortingIndex = 0
        const language = source.language

        // Extraire tous les blocs push([1, "..."])
        // et les concaténer pour reconstituer le RSC payload complet
        const pushRegex = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\[\s\S])*)"\]\)/g
        let rscText = ''
        let pushMatch
        while ((pushMatch = pushRegex.exec(html)) !== null) {
            try {
                // JSON.parse('"..."') désechappe la string JS correctement
                rscText += JSON.parse('"' + pushMatch[1] + '"')
            } catch(e) {
                // ignorer les blocs non parsables
            }
        }

        // Chercher "chapters": dans le RSC déseschappé
        const chaptersKey = '"chapters":'
        const startIdx = rscText.indexOf(chaptersKey)
        if (startIdx === -1) {
            throw new Error(`Couldn't find chapters for mangaId: ${mangaId}!`)
        }

        const arrayStart = startIdx + chaptersKey.length
        const endIdx = rscText.indexOf(',"_count":', arrayStart)
        if (endIdx === -1) {
            throw new Error(`Couldn't find end of chapters for mangaId: ${mangaId}!`)
        }

        let chapterData: any[]
        try {
            chapterData = JSON.parse(rscText.substring(arrayStart, endIdx))
        } catch (e) {
            throw new Error(`Failed to parse chapters JSON: ${e}`)
        }

        for (const chapter of chapterData) {
            const chapterNumber = chapter.number
            const id = String(chapterNumber)

            let title = `Chapitre ${chapterNumber}`
            if (chapter.title) {
                title = chapter.title
            }

            if (chapter.isPremium && chapter.premiumUntil) {
                const freeAt = new Date(chapter.premiumUntil.replace('$D', ''))
                title += ` - Gratuit le ${freeAt.toLocaleDateString('fr-FR')}`
            }

            const date = chapter.createdAt
                ? new Date(chapter.createdAt.replace('$D', ''))
                : new Date()

            chapters.push({
                id: id,
                langCode: language,
                chapNum: chapterNumber,
                name: title,
                time: date,
                sortingIndex,
                volume: 0,
                group: ''
            })
            sortingIndex++
        }

        if (chapters.length === 0) {
            throw new Error(`Couldn't find any chapters for mangaId: ${mangaId}!`)
        }

        return chapters.map((chapter) => {
            chapter.sortingIndex += chapters.length
            return App.createChapter(chapter)
        })
    }

    convertDate(dateString: string): Date {
        const match = dateString.match(/(\d+)\s+(\w+)/i)
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
            'an': 'years', 'ans': 'years', 'ann�e': 'years', 'ann�es': 'years'
        }

        const mappedUnit = unitMap[unit]
        if (!mappedUnit) {
            console.log(`Unknown time unit: "${unit}" in date string: "${dateString}"`)
            return new Date()
        }

        return moment().subtract(amount, mappedUnit).toDate()
    }

    parseChapterDetails($: CheerioAPI, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        let pagesWithId: any[] = []

        for (const img of $('div.chapter-image-container').parent().toArray()) {
            pagesWithId.push({ id: $(img).attr('data-order'), img: this.getImageSrc($('img', img)) })
        }

        pagesWithId.sort((a, b) => {
            return parseInt(a.id) - parseInt(b.id)
        })

        for (const page of pagesWithId) {
            pages.push(page.img)
        }

        const chapterDetails = App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })

        return chapterDetails
    }

    parseTags($: CheerioAPI, genres: string): TagSection[] {
        throw new Error('Not implemented')
    
        const tagSections: any[] = [
            { id: '0', label: 'genres', tags: [] },
            { id: '1', label: 'type', tags: [] },
            { id: '2', label: 'status', tags: [] },
            { id: '3', label: 'sort', tags: [] }
        ]

        const parsed = JSON.parse(genres)
        if (parsed.success && Array.isArray(parsed.data)) {
            parsed.data.forEach((genre: { _id: string; name: string }) => {
                tagSections[0].tags.push(App.createTag({
                    id: genre._id,
                    label: genre.name
                }));
            });
        }

        const dropdowns = $('div.manga-list__filter-group').toArray()
        for (let i = 1; i < 4; ++i) {
            const sectionDropdown = dropdowns[i]
            if (!sectionDropdown) {
                continue
            }

            for (const tag of $('option', sectionDropdown).toArray()) {
                const label = $(tag).attr('value')?.trim()
                const id = `${tagSections[i].label}:${label}`

                if (!id || !label) {
                    continue
                }

                tagSections[i].tags.push(App.createTag({ id, label }))
            }
        }

        return tagSections.map((x) => App.createTagSection(x))
    }

    async parseHomeSection($: CheerioAPI, section: HomeSectionData, source: any): Promise<PartialSourceManga[]> {
        const items: PartialSourceManga[] = []
        const existingIds = new Set<string>()

        const mangas = section.selectorFunc($)
        if (!mangas.length) {
            console.log(`Unable to parse valid ${section.section.title} section!`)
            return items
        }

        for (const manga of mangas.toArray()) {
            const title = section.titleSelectorFunc($, manga)
            const image = this.getImageSrc($('img', manga)) ?? ''
            const subtitle = section.subtitleSelectorFunc($, manga) ?? ''
            let slug: string = this.idCleaner($('a', manga).attr('href') ?? '')
            if (slug === '') {
                slug = this.idCleaner($(manga).attr('href') ?? '')
            }
            const mangaId: string = slug

            if (!mangaId || !title) {
                console.log(`Failed to parse homepage sections for ${source.baseUrl} title (${title}) mangaId (${mangaId})`)
                continue
            }

            if (existingIds.has(mangaId)) {
                console.log(`Skipping duplicate mangaId: ${mangaId}`)
                continue
            }
            existingIds.add(mangaId)

            items.push(App.createPartialSourceManga({
                mangaId,
                image: image,
                title: decodeHTMLEntity(title),
                subtitle: decodeHTMLEntity(subtitle)
            }))
        }

        return items
    }

    async parseSearchResults(html: string, source: any): Promise<any[]> {
        const results: any[] = []
        const $ = load(html)

        for (const manga of $('a.block.group').toArray()) {
            const title = decodeHTMLEntity($('h2', manga).text().trim()).replace(/\s+/g, ' ').replace(/\n/g, ' ')
            const date = '';
            console.log(title)
            const mangaId = title.replace(/\s+/g, '-').replace(/('|’)/g, '').toLowerCase()
            const img = this.getImageSrc($('img', manga)) ?? ''

            results.push({
                mangaId,
                image: img,
                title: title,
                subtitle: ''
            })
        }

        return results
    }

    getImageSrc(imageObj: Cheerio<Element> | undefined): string {
        let image: string | undefined
        if ((typeof imageObj?.attr('src')) != 'undefined') {
            image = imageObj?.attr('src')
        }
        else if ((typeof imageObj?.attr('data-cfsrc')) != 'undefined') {
            image = imageObj?.attr('data-cfsrc')
        }
        else {
            image = ''
        }

        if (image?.includes('/_next/')) {
            image = this.extractBaseImageUrl(image)
        }

        return encodeURI(decodeURI(decodeHTMLEntity(image?.trim())))
    }

    extractBaseImageUrl(optimizedUrl: string): string | null {
        try {
            const match = optimizedUrl.match(/url=([^&]*)/);
            if (!match || !match[1]) {
                console.log("Missing 'url' param.");
                return null;
            }

            const encodedPath = match[1];
            let decodedPath = decodeURIComponent(encodedPath);
            decodedPath = decodedPath.replace(/\.(webp|gif)$/i, '');

            if (! decodedPath.includes(this.domain)) {
                decodedPath = this.domain + decodedPath
            }

            return decodedPath;
        } catch (e) {
            console.log("Erreur lors de l'analyse de l'URL:", e);
            return null;
        }
    }

    protected idCleaner(str: string): string {
        let cleanId: string = str
        cleanId = cleanId.replace(/\/$/, '')
        cleanId = cleanId.split('/').pop() ?? ''

        return cleanId
    }

    isLastPage(json: string) {
        const parsed = JSON.parse(json)

        console.log(JSON.stringify(parsed.pagination))

        return ! parsed.pagination.hasNextPage
    }
}