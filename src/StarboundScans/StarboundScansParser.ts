import {
    ChapterDetails
} from '@paperback/types'
import { CheerioAPI } from 'cheerio'

import {
    MangaStreamParser
} from '../MangaStreamParser'

import { decode as decodeHTMLEntity } from 'html-entities'
import { convertDate } from '../LanguageUtils'

export class StarboundScansParser extends MangaStreamParser {
    override parseMangaDetails($: CheerioAPI, mangaId: string, source: any): SourceManga {
        const titles: string[] = []
        titles.push(decodeHTMLEntity($('h1.entry-title').text().trim()))

        const altTitles = $(`span:contains(${source.manga_selector_AlternativeTitles}), b:contains(${source.manga_selector_AlternativeTitles})+span, .imptdt:contains(${source.manga_selector_AlternativeTitles}) i, h1.entry-title+span`).contents().remove().last().text().split(',') // Language dependant
        for (const title of altTitles) {
            if (title == '') {
                continue
            }
            titles.push(decodeHTMLEntity(title.trim()))
        }

        const author = $(`span:contains(${source.manga_selector_author}), .fmed b:contains(${source.manga_selector_author})+span, .imptdt:contains(${source.manga_selector_author}) i, tr td:contains(${source.manga_selector_author}) + td`).contents().remove().last().text().trim() // Language dependant
        const artist = $(`span:contains(${source.manga_selector_artist}), .fmed b:contains(${source.manga_selector_artist})+span, .imptdt:contains(${source.manga_selector_artist}) i, tr td:contains(${source.manga_selector_artist}) + td`).contents().remove().last().text().trim() // Language dependant
        const image = $('div.bg-cover', $('button'))
        console.log(JSON.stringify(image))
        const description = decodeHTMLEntity($('div[itemprop="description"]  p').text().trim())

        const arrayTags: Tag[] = []
        for (const tag of $('a', source.manga_tag_selector_box).toArray()) {
            const label = $(tag).text().trim()
            const id = this.idCleaner($(tag).attr('href') ?? '')
            if (!id || !label) {
                continue
            }
            arrayTags.push({ id, label })
        }

        const rawStatus = $(`span:contains(${source.manga_selector_status}), .fmed b:contains(${source.manga_selector_status})+span, .imptdt:contains(${source.manga_selector_status}) i`).contents().remove().last().text().trim()
        let status
        switch (rawStatus.toLowerCase()) {
            case source.manga_StatusTypes.ONGOING.toLowerCase():
                status = 'Ongoing'
                break
            case source.manga_StatusTypes.COMPLETED.toLowerCase():
                status = 'Completed'
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

    override parseChapterList($: CheerioAPI, mangaId: string, source: any): Chapter[] {
        const chapters: Chapter[] = []
        let sortingIndex = 0
        let language = source.language

        for (const chapter of $('div#chapters > a').toArray()) {
            const title = decodeHTMLEntity($(chapter).attr('title').trim()).replace(/\s+/g, ' ')
            const date = convertDate($(chapter).attr('d').trim())
            const id = decodeHTMLEntity($(chapter).attr('href').trim()).substr(21, 11) ?? ''
            const chapterNumber = parseFloat(decodeHTMLEntity($(chapter).attr('title').trim()).replace(/Chapitre\s/g, '') ?? '')
            if (!id || typeof id === 'undefined') {
                throw new Error(`Could not parse out ID when getting chapters for postId: ${mangaId}`)
            }

            chapters.push({
                id: id, // Store chapterNumber as id
                langCode: language,
                chapNum: chapterNumber,
                name: title,
                time: date,
                sortingIndex,
                volume: 0,
                group: ''
            })
            sortingIndex--
        }

        // If there are no chapters, throw error to avoid losing progress
        if (chapters.length == 0) {
            throw new Error(`Couldn't find any chapters for mangaId: ${mangaId}!`)
        }

        return chapters.map((chapter) => {
            chapter.sortingIndex += chapters.length
            return App.createChapter(chapter)
        })
    }

    override parseChapterDetails($: CheerioAPI, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []

        for (const img of $('div#pages > img').toArray()) {
            const uid = $(img).attr('uid') ?? ''
            if (!uid) continue
            pages.push('https://image.meowing.org/uploads/' + uid)
        }

        const chapterDetails = App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })

        return chapterDetails
    }

    override isLastPage = ($: CheerioAPI, id: string): boolean => {
        let isLast = true
        const hasNext = Boolean($('a. click_hilltop_click:contains(»)'))
        if (hasNext) {
            isLast = false
        }

        return isLast
    }
}