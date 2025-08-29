import { Chapter, SourceManga, Tag, TagSection } from '@paperback/types'
import { CheerioAPI } from 'cheerio'
import { decode as decodeHTMLEntity } from 'html-entities'
import { Parser } from './MadaraParser'
import moment from 'moment';
import 'moment/locale/fr';

export class StarboundScansParser extends Parser {
    override async parseMangaDetails($: CheerioAPI, mangaId: string, source: any): Promise<SourceManga> {
        const title: string = decodeHTMLEntity($('h1.project-title').text().trim())
        const author: string = ''
        const artist: string = ''
        const description: string = decodeHTMLEntity($('div.project-description-card > div.card-body > div.black-orion-article-content').first().text()).replace('Show more', '').trim()

        const image: string = encodeURI(await this.getImageSrc($('div.project-cover-container img').first(), source))
        const parsedStatus: string = $('div.info-value', $('div.project-info-card').last()).first().text().trim()

        let status: string
        switch (parsedStatus.toUpperCase()) {
            case 'TERMINÉ':
                status = 'Completed'
                break
            default:
                status = 'Ongoing'
                break
        }

        const genres: Tag[] = []
        for (const obj of $('div.genres-list span').toArray()) {
            const label = $(obj).text()
            const id = label

            if (!label || !id) continue
            genres.push(App.createTag({ label: label, id: id }))
        }
        const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'genres', tags: genres })]

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                author: author,
                artist: artist,
                tags: tagSections,
                desc: description,
                status: status
            })
        })
    }

    override parseChapterList($: CheerioAPI, mangaId: string, source: any): Chapter[] {
        const chapters: Chapter[] = []
        let sortingIndex = 0

        // For each available chapter..
        for (const obj of $('div.chapters-list').children().toArray()) {
            const id = this.idCleaner($('a', obj).first().attr('href') ?? '')

            const chapName = $('a', obj).first().text().trim() ?? ''
            const chapNumRegex = id.match(/(?:chapter|ch.*?)(\d+\.?\d?(?:[-_]\d+)?)|(\d+\.?\d?(?:[-_]\d+)?)$/)
            let chapNum: string | number = chapNumRegex && chapNumRegex[1] ? chapNumRegex[1].replace(/[-_]/gm, '.') : chapNumRegex?.[2] ?? '0'

            // make sure the chapter number is a number and not NaN
            chapNum = parseFloat(chapNum) ?? 0

            let mangaTime: Date
            const timeSelector = $('span.chapter-date', obj).text().trim() ?? ''
            if (typeof timeSelector !== 'undefined') {
                // Firstly check if there is a NEW tag, if so parse the time from this
                mangaTime = this.parseDate(timeSelector ?? '')
            } else {
                // Else get the date from the info box
                console.log('Could not parse chapter date, set to today')
                mangaTime = new Date()
            }

            if (!id || typeof id === 'undefined' || id === '#') {
                console.log(`Could not parse out ID when getting chapters for postId:${mangaId} parsedId: ${id}`)
                continue
            }

            chapters.push({
                id: id,
                langCode: source.language,
                chapNum: chapNum,
                name: chapName ? decodeHTMLEntity(chapName) : '',
                time: mangaTime,
                sortingIndex,
                volume: 0,
                group: ''
            })
            sortingIndex--
        }

        if (chapters.length == 0) {
            throw new Error(`Couldn't find any chapters for mangaId: ${mangaId}!`)
        }

        return chapters.map(chapter => {
            chapter.sortingIndex += chapters.length
            return App.createChapter(chapter)
        })
    }

    override parseDate = (date: string): Date => {
        moment.locale('fr')
        
        return moment(date, 'DD MMMM YYYY').toDate()
    }
}
