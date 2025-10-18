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
        
        for (const obj of $(selector).get()) {
            let page = decode(await this.getImageSrc($(obj), source))
            if (!page) {
                console.log(`Could not parse pages for postId:${mangaId} chapterId:${chapterId}`)
                continue
            }
            page = page?.replace(/^http:/g, 'https:')
            pages.push(encodeURI(page))
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }
}