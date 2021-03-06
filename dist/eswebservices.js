/***********************************
 * Entersoft SA
 * http://www.entersoft.eu
 * v0.0.11
 *
 ***********************************/

(function() {
    'use strict';

    /* Services */

    var esWebServices = angular.module('es.Services.Web', ['ngStorage', 'ngSanitize']);

    esWebServices.
    constant('ESWEBAPI_URL', {
        __LOGIN__: "api/Login",
        __PUBLICQUERY__: "api/rpc/PublicQuery/",
        __USERSITES__: "api/Login/Usersites",
        __SCROLLERROOTTABLE__: "api/rpc/SimpleScrollerRootTable/",
        __ENTITYACTION__: "api/Entity/",
        __ENTITYBYGIDACTION__: "api/EntityByGID/",
        __ELASTICSEARCH__: "api/esearch/",
        __SERVER_CAPABILITIES__: "api/Login/ServerCapabilities/",
        __ESLOG_MESSAGE__: "api/logMessage/"

    });

    esWebServices.value("__WEBAPI_RT__", {
        url: ""
    });


    function endsWith(str, suffix) {
        return str.indexOf(suffix, str.length - suffix.length) !== -1;
    }

    function startsWith(str, prefix) {
        return str.toLowerCase().indexOf(prefix.toLowerCase()) === 0;
    }

    function webAPIToken(inStorage) {
        var session = false;

        //pass token for protected pages
        if (typeof inStorage.__esrequest_sesssion !== 'undefined' && inStorage.__esrequest_sesssion !== null) {
            session = inStorage.__esrequest_sesssion;
        }

        if (session) {
            return 'Bearer ' + session.WebApiToken;
        } else {
            return '';
        }
    }
 
    esWebServices.provider("es.Services.WebApi",
        function() {

            var urlWEBAPI = "";
            var unSecureWEBAPI = "";
            var secureWEBAPI = "";

            var esConfigSettings = {
                host: "",
                allowUnsecureConnection: false,
                subscriptionId: "",
                subscriptionPassword: ""
            };

            return {
                getSettings: function() {
                    return esConfigSettings;
                },

                setSettings: function(setting) {
                    var __SECURE_HTTP_PREFIX__ = "https://";
                    var __UNSECURE_HTTP_PREFIX__ = "http://";

                    esConfigSettings = setting;

                    if (esConfigSettings.host) {
                        esConfigSettings.host = esConfigSettings.host.trim();

                        if (startsWith(esConfigSettings.host, __SECURE_HTTP_PREFIX__)) {
                            esConfigSettings.host = esConfigSettings.host.slice(__SECURE_HTTP_PREFIX__.length).trim();
                        } else if (startsWith(esConfigSettings.host, __UNSECURE_HTTP_PREFIX__)) {
                            esConfigSettings.host = esConfigSettings.host.slice(__UNSECURE_HTTP_PREFIX__.length).trim();
                        }

                        if (esConfigSettings.host == "") {
                            throw "host for Entersoft WEB API Server is not specified";
                        }

                        if (!endsWith(esConfigSettings.host, "/")) {
                            esConfigSettings.host += "/";
                        }

                        unSecureWEBAPI = __UNSECURE_HTTP_PREFIX__ + esConfigSettings.host;;
                        secureWEBAPI = __SECURE_HTTP_PREFIX__ + esConfigSettings.host;

                        if (esConfigSettings.allowUnsecureConnection) {
                            urlWEBAPI = unSecureWEBAPI;
                        } else {
                            urlWEBAPI = secureWEBAPI;
                        }

                    } else {
                        throw "host for Entersoft WEB API Server is not specified";
                    }
                    return this;
                },
                $get: ['$http', '$log', '$sessionStorage', '$q', 'ESWEBAPI_URL', function($http, $log, $sessionStorage, $q, ESWEBAPI_URL) {
                    return {

                        openSession: function(credentials) {
                            delete $sessionStorage.__esrequest_sesssion;

                            return $http({
                                method: 'post',
                                url: urlWEBAPI + ESWEBAPI_URL.__LOGIN__,
                                data: {
                                    SubscriptionID: esConfigSettings.subscriptionId,
                                    SubscriptionPassword: esConfigSettings.subscriptionPassword,
                                    Model: credentials
                                }
                            });
                        },

                        setUser: function(data) {
                            var tok = data.Model;
                            $sessionStorage.__esrequest_sesssion = tok;
                        },

                        getUser: function() {
                            return $sessionStorage.__esrequest_sesssion || false;
                        },

                        /**
                         * invalidates a session (useful for logout actions or when session has expired)
                         */
                        invalidateUser: function () {
                            delete $sessionStorage.__esrequest_sesssion;
                        },

                        logout: function() {
                            delete $sessionStorage.__esrequest_sesssion;
                        },

                        esLog: function(inMessageObj) {
                            if (!inMessageObj) {
                                return;
                            }

                            var messageObj = angular.copy(inMessageObj);
                            
                            try {
                                messageObj.__SubscriptionID = esConfigSettings.subscriptionId;
                                messageObj.__ServerUrl = urlWEBAPI;
                                messageObj.__EDate = new Date();
                                $.ajax({
                                    type: "POST",
                                    url: urlWEBAPI.concat(ESWEBAPI_URL.__ESLOG_MESSAGE__),
                                    contentType: "application/json",
                                    headers: {
                                        "Authorization": webAPIToken($sessionStorage)
                                    },
                                    data: angular.toJson(messageObj)
                                });

                            } catch (loggingError) {

                                // For Developers - log the log-failure.
                                $log.warn("Error logging failed");
                                $log.log(loggingError);
                            }
                        },

                        fetchServerCapabilities: function() {

                            var defered = $q.defer();

                            $http.get(unSecureWEBAPI + ESWEBAPI_URL.__SERVER_CAPABILITIES__)
                                .success(function(data) {
                                    defered.resolve(data);
                                })
                                .error(function() {
                                    $http.get(secureWEBAPI + ESWEBAPI_URL.__SERVER_CAPABILITIES__)
                                        .success(function(data) {
                                            defered.resolve(data);
                                        })
                                        .error(function(dat, stat, header, config) {
                                            defered.reject([dat, stat, header, config]);
                                        });
                                });

                            return defered.promise;
                        },

                        fetchSimpleScrollerRootTable: function(GroupID, FilterID, Params) {
                            var surl = urlWEBAPI.concat(ESWEBAPI_URL.__SCROLLERROOTTABLE__, GroupID, "/", FilterID);

                            return $http({
                                method: 'get',
                                headers: {
                                    "Authorization": webAPIToken($sessionStorage)
                                },
                                url: surl,
                                data: Params
                            });
                        },

                        fetchUserSites: function(ebsuser) {
                            return $http({
                                method: 'post',
                                url: urlWEBAPI + ESWEBAPI_URL.__USERSITES__,
                                data: {
                                    SubscriptionID: esConfigSettings.subscriptionId,
                                    SubscriptionPassword: esConfigSettings.subscriptionPassword,
                                    Model: ebsuser
                                }
                            });
                        },

                        executeNewEntityAction: function(entityType, entityObject, actionID) {
                            var surl = urlWEBAPI.concat(ESWEBAPI_URL.__ENTITYACTION__, entityType, "/", actionID);

                            return $http({
                                method: 'post',
                                headers: {
                                    "Authorization": webAPIToken($sessionStorage)
                                },
                                url: surl,
                                data: entityObject
                            });

                        },

                        executeEntityActionByCode: function(entityType, entityCode, entityObject, actionID) {
                            var surl = urlWEBAPI.concat(ESWEBAPI_URL.__ENTITYACTION__, entityType, "/", entityCode, "/", actionID);

                            return $http({
                                method: 'post',
                                headers: {
                                    "Authorization": webAPIToken($sessionStorage)
                                },
                                url: surl,
                                data: entityObject
                            });

                        },

                        executeEntityActionByGID: function(entityType, entityGID, entityObject, actionID) {
                            var surl = urlWEBAPI.concat(ESWEBAPI_URL.__ENTITYBYGIDACTION__, entityType, "/", entityGID, "/", actionID);

                            return $http({
                                method: 'post',
                                headers: {
                                    "Authorization": webAPIToken($sessionStorage)
                                },
                                url: surl,
                                data: entityObject
                            });

                        },

                        fetchPublicQuery: function(GroupID, FilterID, Params) {
                            var surl = urlWEBAPI.concat(ESWEBAPI_URL.__PUBLICQUERY__, GroupID, "/", FilterID);

                            return $http({
                                method: 'get',
                                headers: {
                                    "Authorization": webAPIToken($sessionStorage)
                                },
                                url: surl,
                                data: Params
                            });
                        },

                        eSearch: function(eUrl, eMethod, eBody) {
                            var surl = urlWEBAPI.concat(ESWEBAPI_URL.__ELASTICSEARCH__, eUrl);

                            return $http({
                                method: eMethod,
                                headers: {
                                    "Authorization": webAPIToken($sessionStorage)
                                },
                                url: surl,
                                data: eBody
                            });
                        }
                    }
                }]
            }
        }
    );

    esWebServices.factory('es.Services.ElasticSearch', ['es.Services.WebApi',
        function(esWebApi) {
            return {
                searchIndex: function(index, body) {
                    var eUrl = index + "/_search";
                    return esWebApi.eSearch(eUrl, "post", body);
                },

                searchIndexAndDocument: function(index, docType, body) {
                    var eUrl = index + "/" + docType + "/_search";
                    return esWebApi.eSearch(eUrl, "post", body);
                },

                searchFree: esWebApi.eSearch
            };
        }
    ]);

}());
