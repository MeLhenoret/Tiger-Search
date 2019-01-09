
describe("join", function () {

    it("should be able to join two documents", function () {

        const docs1 = [{docid: 123}, {docid: 234}]
        const docs2 = [{docid: 345}, {docid: 123}]

        const docs = join(docs1, docs2)

        expect(docs).toEqual([{docid: 123}])
    })

    it("should be able to join variadic documents", function () {

        const docsByText       = [{docid: 123}, {docid: 234}]
        const docsByLaboratory = [{docid: 345}, {docid: 123}]
        const docsByUniversity = [{docid: 123}, {docid: 456}]
        const docsByCoAuthor   = [{docid: 567}, {docid: 123}]

        const docs = join(docsByText, docsByLaboratory, docsByUniversity, docsByCoAuthor)

        expect(docs).toEqual([{docid: 123}])
    })

})
