import { CheerioAPI } from 'cheerio'
import { Parser } from "./MadaraParser";
import { decode as decodeHTMLEntity } from 'html-entities'
import { SourceManga, Tag, TagSection } from "@paperback/types";

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
        
        for (const el of $(selector).toArray()) {
            const node = $(el)
            let page: string | null = null

            /** ───────────────
             * 1️⃣ PROTECTED MODE (data-r + data-v + data-m)
             * ─────────────── */
            const dataR = node.attr('data-r')
            const dataV = node.attr('data-v')
            const dataM = node.attr('data-m')

            if (dataR && dataV && dataM) {
                try {
                    page = this.decodeProtected(dataR, dataV, dataM)
                    console.log("page : " + page)
                } catch {
                    page = null
                }
            }

            /** ───────────────
             * 2️⃣ BASE64 SRC FALLBACK
             * ─────────────── */
            if (!page) {
                const dataSrc = node.attr('data-src')
                page = this.decodeBase64Safe(dataSrc)
            }

            /** ───────────────
             * 3️⃣ NORMAL <img src> FALLBACK
             * ─────────────── */
            if (!page) {
                page = node.find('img').attr('src') ?? null
            }

            if (!page) {
                console.log(`Could not resolve image for ${mangaId} ${chapterId}`)
                continue
            }

            page = page.replace(/^http:/, 'https:')
            pages.push(encodeURI(page))
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

    private decodeBase64Safe(input?: string): string | null {
        if (!input) return null
        try {
            return this.bytesToString(this.base64ToBytes(input))
        } catch {
            return null
        }
    }

    private base64ToBytes(b64: string): Uint8Array {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
        const lookup = new Uint8Array(256)

        for (let i = 0; i < chars.length; i++) {
            lookup[chars.charCodeAt(i)] = i
        }

        let bufferLength = b64.length * 0.75
        if (b64.endsWith('==')) bufferLength -= 2
        else if (b64.endsWith('=')) bufferLength -= 1

        const bytes = new Uint8Array(bufferLength)

        let p = 0
        for (let i = 0; i < b64.length; i += 4) {
            const enc1 = lookup[b64.charCodeAt(i)]
            const enc2 = lookup[b64.charCodeAt(i + 1)]
            const enc3 = lookup[b64.charCodeAt(i + 2)]
            const enc4 = lookup[b64.charCodeAt(i + 3)]

            bytes[p++] = (enc1 << 2) | (enc2 >> 4)
            if (enc3 !== 64)
                bytes[p++] = ((enc2 & 15) << 4) | (enc3 >> 2)
            if (enc4 !== 64)
                bytes[p++] = ((enc3 & 3) << 6) | enc4
        }

        return bytes
    }

    private bytesToString(bytes: Uint8Array): string {
        let result = ''
        for (let i = 0; i < bytes.length; i++) {
            result += String.fromCharCode(bytes[i])
        }
        return result
    }

    private decodeProtected(dataR: string, dataV: string, dataM: string): string {
        const rBytes = this.base64ToBytes(dataR.split('').reverse().join(''))
        const vBytes = this.base64ToBytes(dataV)
        const mBytes = this.base64ToBytes(dataM)

        const len = Math.max(rBytes.length, vBytes.length, mBytes.length)
        const out = new Uint8Array(len)

        for (let i = 0; i < len; i++) {
            out[i] = rBytes[i % rBytes.length] ^ vBytes[i % vBytes.length] ^ mBytes[i % mBytes.length]
        }

        return this.bytesToString(out)
    }
}