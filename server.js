const fs = require('fs')
const http = require('http')
const https = require('https')
const crypto = require('crypto')
const path = require('path')
const request = require('request')
const express = require('express')
const randtoken = require('rand-token');
const app = express()
const exec = require('child_process').exec
const ruby = require('ruby')
const curl = require('curlrequest');
const axios = require('axios');
const accents = require('remove-accents');
const findInFiles = require('find-in-files');
const unique = require('array-unique')

const token_duration = 600  // token duration (in seconds)
const tokens = []
const tokens_date = {}

// Fill stop word
const englishStopWords = []
const frenchStopWords = []

let lineReader = require('readline').createInterface({
    input: require('fs').createReadStream('bonus/english.txt')
})

let lineReaderBis = require('readline').createInterface({
    input: require('fs').createReadStream('bonus/french.txt')
})

lineReader.on('line', function (line) {
    englishStopWords.push(line)
})

lineReaderBis.on('line', function (line) {
    frenchStopWords.push(line)
})

// ------

app.use(express.static('static'))

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname+'/client.html'))
})

/**
 * Fonction pour permettre l'authentification
 */
app.get('/login', function (req, res) {
    // load the database
    let users = JSON.parse(fs.readFileSync("userListe"));

    // check in the database if the user is already registered
    // if he is in it, it check the given password
    let userFound = 0;
    for (user in users){
        if (users[user]["id"] === req.query.username){
            userFound = 1;
            if (sha256(req.query.password+users[user]["sel"]) === users[user]["hash"]){
                // Generate a 16 character alpha-numeric token
                const token = randtoken.generate(16)
                tokens.push(token)
                tokens_date[token] = new Date().getTime() / 1000  // give the date in second
                return res.send('{"token":"' + token + '"}')
            } else {
                return res.send('{"error":34}') // wrong password
            }
        }
    }

    if(userFound === 0){
        return res.send('{"error":33}')  // wrong login
    }

})

app.get('/register', function(req, res) {

    let users = JSON.parse(fs.readFileSync("userListe"));

    for (user in users){
        if (users[user]["id"] === req.query.username){
            return res.send('{"error":35}')  // username already taken
        }
    }

    new_sel = crypto.randomBytes(10).toString('hex');
    let newUser = {
        id: req.query.username,
        sel: new_sel,
        hash: sha256(req.query.password+new_sel)
    }

    users[req.query.username] = newUser;
    fs.writeFileSync("userListe", JSON.stringify(users))

    // Generate a 16 character alpha-numeric token
    const token = randtoken.generate(16)
    tokens.push(token)
    tokens_date[token] = new Date().getTime() / 1000  // give the date in second
    return res.send('{"token":"' + token + '"}')

})

app.get('/search', function(req, res) {

    if (!req.query.token || !tokens.includes(req.query.token)) {
        return res.send('{"error":56}')

    }else{

        current_time = new Date().getTime() / 1000  // give the date in second
        if (current_time - tokens_date[req.query.token] > token_duration){  // if token older than 10 seconds

            tokens.pop(req.query.token)
            delete tokens_date[req.query.token];
            return res.send('{"error":56}')
        }
    }

    const dataToKeep = '&fl=abstract_s&fl=language_s&fl=authFullName_s&fl=docid&fl=title_s'
    const rebuild = new Rebuild(res)

    if (req.query.title) {
        rebuild.title = true
        request('http://api.archives-ouvertes.fr/search/?q=title_t:' + req.query.title + dataToKeep, function (error, response, body) {
            rebuild.allData.docsTitle = (JSON.parse(body)).response.docs
            rebuild.titleComplete = true
            rebuild.tryRespond()
        })
    }

    if (req.query.labo) {
        rebuild.labo = true
        request('http://api.archives-ouvertes.fr/search/?q=labStructAcronym_t:' + req.query.labo + dataToKeep, function (error, response, body) {
            rebuild.allData.docsLabo = (JSON.parse(body)).response.docs
            rebuild.laboComplete = true
            rebuild.tryRespond()
        })
    }

    if (req.query.univ) {
        rebuild.univ = true
        request('http://api.archives-ouvertes.fr/search/?q=authOrganism_t:' + req.query.univ + dataToKeep, function (error, response, body) {
            rebuild.allData.docsUniv = (JSON.parse(body)).response.docs
            rebuild.univComplete = true
            rebuild.tryRespond()
        })
    }
    if (req.query.coAuthor) {
        rebuild.coAuthor = true
        request('http://api.archives-ouvertes.fr/search/?q=authFullName_t:' + req.query.coAuthor + dataToKeep, function (error, response, body) {
            rebuild.coAuthorComplete = true


            const docAuthor = (JSON.parse(body)).response.docs
            /*
            process.stdout.write( "AUTHOR = "+docAuthor.length)
            // Then process all documents in JSON
            for (let nb_doc in docAuthor) {
                process.stdout.write( " ***** " + docAuthor[nb_doc].authFullName_s)
                const author_list = docAuthor[nb_doc].authFullName_s
                // If the wanted author is not a co-author
                if (author_list[0] === req.query.coAuthor) {

                    //Delete this document from the answer
                    docAuthor.splice(nb_doc, 1);
                }
            }
            */
            rebuild.allData.docsCoAuthor = docAuthor
            rebuild.tryRespond()
        })
    }

})

app.get('/similar', function(req, res) {

    if (!req.query.author) {
        return res.send('{"error":81}')
    }

    // First, get author's corpus
    axios({
        url: "http://localhost:9200/_search",
        method: "GET",
        data: {
            "query": {
                "term": {
                    "author.keyword": req.query.author
                }
            }
        },
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        // Then, get document id and request more like

        let ids = []
        response.data.hits.hits.forEach(hit => {
            ids.push({
                _index: "doc",
                _type: "entry",
                _id: hit._id
            })
        })

        axios({
            url: "http://localhost:9200/_search",
            method: "GET",
            data: {
                "query": {
                    "more_like_this" : {
                        "fields" : ["words"],
                        "like" : ids,
                        "min_term_freq" : 1,
                        "min_doc_freq": 1
                    }
                }
            },
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            //console.log(response.data.hits.hits[1])
            res.send(response.data.hits.hits)
        })
        .catch(err => {
            console.log(err)
            res.send('{"error":90}')
        })

    })
    .catch(err => {
        //console.log(err)
        res.send('{"error":94}')
    })
})

const privateKey = fs.readFileSync('sslcert/key.pem', 'utf8')
const certificate = fs.readFileSync('sslcert/cert.pem', 'utf8')
const credentials = {key: privateKey, cert: certificate}

https.createServer(credentials, app).listen(8443)

/**
 * Create server http to https
 */
http.createServer(function(req, res) {
    res.writeHead(301, { "Location": "https://" + req.headers['host'].replace('8080', '8443') + req.url })
    res.end()
}).listen(8080)

console.log("Start https server on 8443 and http server on 8080")

/**
 * Fonction de hashage (Sha 256) pour le mot de passe
 * @param clear : mot de passe en clair
 */
function sha256(clear) {
    return crypto.createHash('sha256').update(clear).digest('base64')
}


class Rebuild {

    constructor(response) {
        // Callback to client
        this.res = response

        // Store async data from hal
        this.allData = {
            docsTitle: [],
            docsLabo: [],
            docsUniv: [],
            docsCoAuthor: []
        }

        // Return one request when everything is loaded
        this.title = false
        this.labo = false
        this.univ = false
        this.coAuthor = false

        this.titleComplete = false
        this.laboComplete = false
        this.univComplete = false
        this.coAuthorComplete = false
    }

    // Check if everything is received
    isComplete() {
        return (this.title === this.titleComplete) &&
            (this.labo === this.laboComplete) &&
            (this.univ === this.univComplete) &&
            (this.coAuthor === this.coAuthorComplete)
    }

    tryRespond() {
        if (this.isComplete()) {

            let docs = []

            if (this.title) {
                docs.push(this.allData.docsTitle)
            }

            if (this.labo) {
                docs.push(this.allData.docsLabo)
            }

            if (this.univ) {
                docs.push(this.allData.docsUniv)
            }

            if (this.coAuthor) {
                docs.push(this.allData.docsCoAuthor)
            }

            let result = []
            if (docs.length > 1) {
                result = this.join(...docs)

            } else {
                result = docs[0]
            }
            this.matrixDocs( result);
            this.res.send(JSON.stringify(result))
        }
    }

    join(docs, ...others) {
        if (others.length === 1) {
            return this.joinTwo(docs, others[0])
        }
        const result = this.joinTwo(docs, others[0])
        return this.join(result, others.shift())
    }

    // Take two docs array, return the intersect
    joinTwo(recto, verso) {

        const docs = []
        recto.forEach(function(r) {
            verso.forEach(function(v) {
                if (r.docid === v.docid) {
                    docs.push(r)
                }
            })
        })

        return docs

    }

    /**
     * Fonction récupérant les mots des résumés des documents
     * @param docs
     */
    matrixDocs( docs)
    {
        docs.forEach(function(element) {

            if( element.abstract_s ) {
                let words = []

                let str = element.abstract_s.toString().toLowerCase()
                str.split(' ').forEach(word => {

                    if (!englishStopWords.includes(word) && !frenchStopWords.includes(word)) {

                        let newWord = word.replace(/[éèêë]/, 'e')
                            .replace(/[à]/, 'a')
                            .replace(/[ù]/, 'u')
                            .replace(/[ï]/, 'i')
                            .replace(/[ç]/, 'c')
                            .replace("d'", '')
                            .replace("l'", '')
                            .replace(/[^a-z]/g, '')

                        if (newWord !== "") {
                            words.push(newWord)
                        }
                    }
                })

                words = unique(words)

                element.authFullName_s.forEach(author => {
                    axios.post("http://localhost:9200/doc/entry", {
                        author: author,
                        words: words
                    })
                    .then(res => {
                        //console.log(res)
                    })
                    .catch(err => {
                        //console.log(err)
                    })
                })

            }

        });
    }
}
