angular.module('searchApp', ['ngRoute'])

    /**
     * Objet partagé entre controlloer
     */
    .factory('Detail', function() {
        return { token: "" }
    })

    /**
     * Routes
     */
    .config(function($routeProvider) {
        $routeProvider
            .when('/', {
                templateUrl : 'pages/home.html',
                controller  : 'homeController'
            })
            .when('/login', {
                templateUrl : 'pages/login.html',
                controller  : 'loginController'
            })
            .when('/search', {
                templateUrl : 'pages/search.html',
                controller  : 'searchController'
            })
            .when('/similar', {
                templateUrl : 'pages/similar.html',
                controller  : 'similarController'
            })
    })

    /**
     * Controller pour la page principal
     */
    .controller('homeController', function ($scope, $location, Detail) {
        $scope.launch = function() {
            const token = window.sessionStorage.getItem("token")
            if (token) {
                Detail.token = token
                $location.path("/search")

            } else {
                $location.path("/login")
            }
        }
    })

    /**
     * Controller pour le login
     */
    .controller('loginController', function ($scope, $http, $location, Detail) {

        function onToken(token) {
            window.sessionStorage.setItem("token", token)
            Detail.token = token
            $location.path("/search")
        }

        $scope.login = function () {
            $http.get('/login?username=' + $scope.username + '&password=' + $scope.password)
            $scope.errorMdp = false
            $scope.errorUserName = false
            $scope.errorAlreadyUse = false
            $http.get('/login?username=' + $scope.username + '&password=' + $scope.password)
                .then(function (response) {
                    if( response.data.token) {
                        onToken(response.data.token)
                    // S'il y a une erreur
                    }else{
                        // Mauvais mot de passe
                        if( response.data.error === 34)
                        {
                            $scope.errorMdp = true
                        // Mauvais login
                        }else if( response.data.error === 33)
                        {
                            $scope.errorUserName = true
                        }
                    }
                })
        }

        $scope.register = function () {
            $http.get('/register?username=' + $scope.username + '&password=' + $scope.password)
                .then(function (response) {
                    $scope.errorMdp = false
                    $scope.errorUserName = false
                    $scope.errorAlreadyUse = false
                    if( response.data.error === 35)
                    {
                        $scope.errorAlreadyUse = true
                    }else
                    {
                        onToken(response.data.token)
                    }
                })
        }
    })

    /**
     * Controller pour la recherche
     */
    .controller('searchController', function ($scope, $http, $location, Detail) {

        const token = window.sessionStorage.getItem("token")
        if (token) {
            Detail.token = token

        } else {
            $location.path("/login")
        }

        $scope.submit = function() {

            let url = "/search?token=" + Detail.token

            if ($scope.query) {
                url += "&title=" + $scope.query
            }

            if ($scope.labo) {
                url += "&labo=" + $scope.labo
            }

            if ($scope.univ) {
                url += "&univ=" + $scope.univ
            }

            if ($scope.coAuthor) {
                url += "&coAuthor=" + $scope.coAuthor
            }

            $http.get(url)
                .then(function (response) {
                    if( response.data.error === 56) {
                        $location.path("/login")
                    }
                    $scope.docs = response.data
                })
        }
    })

    .controller('similarController', function ($scope, $http, $location, Detail) {
        $scope.similarAuthors = []

        $scope.similarSubmit = function() {

            $http.get('/similar?author=' + $scope.similarAuthorQuery)
                .then(res => {

                    $scope.similarAuthors = []
                    
                    console.log(res.data);
                    res.data.forEach(doc => {
                        if ($scope.similarAuthors.includes(doc._source.author) === false && doc._source.author !== $scope.similarAuthorQuery) {
                            $scope.similarAuthors.push(doc._source.author)
                        }
                    })
                })
        }
    })
