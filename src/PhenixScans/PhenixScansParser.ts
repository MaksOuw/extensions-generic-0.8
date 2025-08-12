import { Chapter, ChapterDetails, PartialSourceManga, SourceManga, Tag, TagSection } from "@paperback/types"
import { Cheerio, CheerioAPI } from "cheerio"
import { decode as decodeHTMLEntity } from 'html-entities'
import { convertDate } from "./Utils"
import { HomeSectionData } from "./PhenixScansHelpers"

export class PhenixScansParser {
    parseMangaDetails($: CheerioAPI, mangaId: string, source: any): SourceManga {
        const titles: string[] = []
        titles.push(decodeHTMLEntity($('h1.project__content-informations-title').text().trim()))

        const author = ''
        const artist = ''
        const image = this.getImageSrc($('img.project__cover'))
        const description = decodeHTMLEntity($('div.project__content-synopsis > p').text().trim())

        const arrayTags: Tag[] = []
        for (const tag of $('a', 'project__content-tags').toArray()) {
            const label = $(tag).text().trim()
            const id = this.idCleaner($(tag).attr('href') ?? '')
            if (!id || !label) {
                continue
            }
            arrayTags.push({ id, label })
        }

        const rawStatus = $(`span:contains(${source.manga_selector_status})`).parent().next().contents().text().trim()
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

    parseChapterList($: CheerioAPI, mangaId: string, source: any): Chapter[] {
        const chapters: Chapter[] = []
        let sortingIndex = 0
        const language = source.language

        for (const chapter of $('a.project__chapter').toArray()) {
            const title = decodeHTMLEntity($('span.project__chapter-title', chapter).text().trim()).replace(/\s+/g, ' ')
            const date = convertDate($('div.project__chapter-date', chapter).text().trim())
            const id = title.match(/\d+/g)[0] ?? ''
            const chapterNumber = parseInt(id)
            if (!id || typeof id === 'undefined') {
                throw new Error(`Could not parse out ID when getting chapters for postId: ${mangaId}`)
            }

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
            sortingIndex--
        }

        if (chapters.length == 0) {
            throw new Error(`Couldn't find any chapters for mangaId: ${mangaId}!`)
        }

        return chapters.map((chapter) => {
            chapter.sortingIndex += chapters.length
            return App.createChapter(chapter)
        })
    }

    parseChapterDetails($: CheerioAPI, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []

        for (const img of $('div.vertical.chapter-images > img').toArray()) {
            pages.push(this.getImageSrc($(img)))
        }

        const chapterDetails = App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })

        return chapterDetails
    }

    parseTags($: CheerioAPI, genres: string): TagSection[] {
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

        const mangas = section.selectorFunc($)
        if (!mangas.length) {
            console.log(`Unable to parse valid ${section.section.title} section!`)
            return items
        }

        for (const manga of mangas.toArray()) {
            const title = section.titleSelectorFunc($, manga)
            const image = this.getImageSrc($('[class$=card-image] img', manga)) ?? ''
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

            items.push(App.createPartialSourceManga({
                mangaId,
                image: image,
                title: decodeHTMLEntity(title),
                subtitle: decodeHTMLEntity(subtitle)
            }))
        }

        return items
    }

    async parseSearchResults(json: string, source: any): Promise<any[]> {
        const results: any[] = []
        const parsed = JSON.parse(json)
        if (Array.isArray(parsed.mangas)) {
            parsed.mangas.forEach((manga: { _id: string; title: string, coverImage: string }) => {
                let mangaId: string = manga._id
                results.push({
                    mangaId,
                    image: `${source.baseUrl}/api/${manga.coverImage}`,
                    title: decodeHTMLEntity(manga.title),
                    subtitle: ''
                })
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

        image = image?.split('?resize')[0] ?? ''
        image = image.replace(/^\/\//, 'https://')
        image = image.replace(/^\//, 'https:/')
        image = image.replace(/\&width\=\d*/, '')

        return encodeURI(decodeURI(decodeHTMLEntity(image?.trim())))
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