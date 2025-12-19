import {
    CheerioAPI,
    Cheerio
} from 'cheerio'
import { Parser } from "./MadaraParser";
import { decode as decodeHTMLEntity } from 'html-entities'
import { decode } from 'base-64'
import { SourceManga, Tag, TagSection } from "@paperback/types";
import { convertDate } from '../Utils';

export class RaijinScanParser extends Parser {
    override async parseMangaDetails($: CheerioAPI, mangaId: string, source: any): Promise<SourceManga> {
        const title: string = decodeHTMLEntity($('h1.serie-title').text().trim())
        const author: string = decodeHTMLEntity($('span.stat-label:contains("Auteur")').next().text().replace('\\n', '').trim()).replace('Updating', '')
        const artist: string = decodeHTMLEntity($('span.stat-label:contains("Artiste")').next().text().replace('\\n', '').trim()).replace('Updating', '')
        const description: string = decodeHTMLEntity($('div.description-content').text()).replace('Show more', '').trim()

        const image: string = encodeURI(await this.getImageSrc($('img.cover'), source))
        const parsedStatus: string = $('span.stat-label:contains("État du titre")').next().text().trim()

        let status: string
        switch (parsedStatus) {
            case 'Terminé':
                status = 'Completed'
                break
            default:
                status = 'Ongoing'
                break
        }

        const genres: Tag[] = []
        for (const obj of $('div.genres-link').toArray()) {
            const label = $(obj).text()
            const id = $(obj).attr('href')?.split('/')[4] ?? label

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

    override async parseProtectedChapterDetails($: CheerioAPI, mangaId: string, chapterId: string, selector: string, source: any): Promise<ChapterDetails> {
        const pages: string[] = []
        
        try {
            pages = this.decodeRMD($)
                .map(p => encodeURI(p.replace(/^http:/, 'https:')))
        } catch (e) {
            console.log(`Failed to decode RMD for ${mangaId} ${chapterId}`)
        }

        if (!pages.length) {
            try {
                pages = this.decodeRMT($)
                    .map(p => encodeURI(p.replace(/^http:/, 'https:')))
            } catch {
                console.log(`Failed to decode images for ${mangaId} ${chapterId}`)
            }
        }

        if (!pages.length) {
            throw new Error(`No pages parsed for ${mangaId} chapter ${chapterId}`)
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    private decodeRMT($: CheerioAPI): string[] {
        const html = $.html()
        const match = /window\._rmt\s*=\s*"([^"]+)"/.exec(html)

        if (!match) {
            throw new Error('RMT data not found')
        }

        const decoded = decodeBase64(match[1])
        const pages = JSON.parse(decoded)

        if (!Array.isArray(pages)) {
            throw new Error('Invalid RMT payload')
        }

        return pages
    }
    
    private decodeRMD($: CheerioAPI): string[] {
        const html = $.html()

        const rmdMatch = /window\._rmd\s*=\s*"([^"]+)"/.exec(html)
        const rmkMatch = /window\._rmk\s*=\s*"([^"]+)"/.exec(html)

        if (!rmdMatch || !rmkMatch) {
            throw new Error('RMD or RMK not found')
        }

        const rmdBytes = Uint8Array.from(decode(rmdMatch[1]), c => c.charCodeAt(0))
        const rmkBytes = Uint8Array.from(decode(rmkMatch[1]), c => c.charCodeAt(0))

        const out = new Uint8Array(rmdBytes.length)

        for (let i = 0; i < rmdBytes.length; i++) {
            out[i] = rmdBytes[i] ^ rmkBytes[i % rmkBytes.length]
        }

        const decoded = String.fromCharCode(...out)
        const pages = JSON.parse(decoded)

        if (!Array.isArray(pages)) {
            throw new Error('Invalid decoded RMD payload')
        }

        return pages
    }
}