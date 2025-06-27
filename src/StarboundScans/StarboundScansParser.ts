import {
    ChapterDetails
} from '@paperback/types'
import { CheerioAPI } from 'cheerio'

import {
    MangaStreamParser
} from '../MangaStreamParser'


export class StarboundScansParser extends MangaStreamParser {
    override parseChapterList($: CheerioAPI, mangaId: string, source: any): Chapter[] {
        const chapters: Chapter[] = []
        let sortingIndex = 0
        let language = source.language

        for (const chapter of $('div#chapters').toArray()) {
            const title = decodeHTMLEntity($('a', chapter).attribs['title'].trim()).replace(/\s+/g, ' ')
            const date = convertDate($('a', chapter).attribs['d'].trim(), source)
            // Set data-num attribute as id
            const id = decodeHTMLEntity($('a', chapter).attribs['title'].trim()).replace(/Chapitre\s/g, '') ?? ''
            const chapterNumberRegex = id.match(/(\d+\.?\d?)+/)
            let chapterNumber = 0
            if (chapterNumberRegex && chapterNumberRegex[1]) {
                chapterNumber = Number(chapterNumberRegex[1])
            }

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

        for (const img of $('img', '#pages').toArray()) {
            const image = $(img).attr('src') ?? ''
            if (!image) continue
            pages.push(image)
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