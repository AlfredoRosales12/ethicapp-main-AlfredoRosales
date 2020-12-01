"use strict";

var adpp = angular.module("Admin", ["ui.bootstrap", "ui.multiselect", "nvd3", "timer", "ui-notification", "ngQuill",
    "ngMap", "tableSort", 'btford.socket-io']);

var DASHBOARD_AUTOREALOD = window.location.hostname.indexOf("fen") != -1;
var DASHBOARD_AUTOREALOD_TIME = 15;

window.DIC = null;
window.warnDIC = {};

app.factory("$socket", ["socketFactory", function (socketFactory) {
    return socketFactory();
}]);

adpp.config(['ngQuillConfigProvider', function (ngQuillConfigProvider) {
    ngQuillConfigProvider.set({
        modules: {
            formula: true,
            toolbar: {
                container: [['bold', 'italic', 'underline', 'strike'], // toggled buttons

                [{ 'color': [] }, { 'background': [] }], // dropdown with defaults from theme
                [{ 'font': [] }], [{ 'align': [] }],

                //[{ 'header': 1 }, { 'header': 2 }],               // custom button values
                [{ 'list': 'ordered' }, { 'list': 'bullet' }], [{ 'script': 'sub' }, { 'script': 'super' }], // superscript/subscript

                //[{ 'indent': '-1'}, { 'indent': '+1' }],          // outdent/indent
                //[{ 'direction': 'rtl' }],                         // text direction

                //['blockquote', 'code-block'],
                [{ 'size': ['small', false, 'large', 'huge'] }], // custom dropdown
                //[{ 'header': [1, 2, 3, 4, 5, 6, false] }],

                ['clean'], // remove formatting button
                ['image', 'link', 'video'], // remove formatting button
                ['formula']
                //['map']
                ],
                handlers: {
                    map: quillMapHandler
                }
            }
        }
    });
}]);

adpp.controller("AdminController", function ($scope, $http, $uibModal, $location, $locale, $filter, $socket) {
    var self = $scope;

    self.temp = "";

    $locale.NUMBER_FORMATS.GROUP_SEP = '';
    self.shared = {};
    self.sessions = [];

    self.selectedSes = null;
    self.documents = [];
    self.questions = [];
    self.questionTexts = [];
    self.newUsers = [];
    self.users = {};
    self.selectedId = -1;
    self.sesStatusses = ["notPublicada", "reading", "personal", "anon", "teamWork", "finished"];
    self.optConfidence = [0, 25, 50, 75, 100];
    self.iterationNames = [];
    self.showSeslist = true;
    self.superBar = false;
    self.lang = "english";
    self.secIcons = { configuration: "cog", editor: "edit", dashboard: "bar-chart", users: "male",
        rubrica: "check-square", groups: "users", options: "sliders" };
    self.typeNames = { L: "readComp", S: "multSel", M: "semUnits", E: "ethics", R: "rolePlaying", T: "ethics", J: "jigsaw" };

    self.misc = {};

    self.init = function () {
        self.getMe();
        self.shared.updateSesData();
        self.updateLang(self.lang);
        $socket.on("stateChange", (data) => {
            console.log("SOCKET.IO", data);
            if (data.ses == self.selectedSes.id) {
                window.location.reload();
            }
        });
    };

    self.getMe = function(){
        $http.get("is-super").success(data => {
            if(data.status == "ok"){
                self.superBar = true;
            }
        });
    };

    self.selectSession = function (ses, id) {
        self.selectedId = id;
        self.selectedSes = ses;
        self.requestDocuments();
        self.requestSemDocuments();
        self.requestQuestions();
        self.getNewUsers();
        self.getMembers();
        self.shared.verifyGroups();
        self.shared.resetGraphs();
        self.shared.verifyTabs();
        self.shared.resetTab();
        self.shared.updateConf();
        $location.path(self.selectedSes.id);
        if(self.shared.getStages)
            self.shared.getStages();
    };

    self.shared.updateSesData = function () {
        $http({ url: "get-session-list", method: "post" }).success(function (data) {
            console.log("Session data updated");
            self.sessions = data;
            if (self.selectedId != -1) {
                var ses = self.sessions.find(function (e) {
                    return e.id == self.selectedId;
                });
                if (ses != null) self.selectSession(ses, self.selectedId);
            } else {
                self.sesFromURL();
            }
        });
    };

    self.sesFromURL = function () {
        var sesid = +$location.path().substring(1);
        var ses = self.sessions.find(function (e) {
            return e.id == sesid;
        });
        if (ses != null) self.selectSession(ses, sesid);
    };

    self.requestDocuments = function () {
        var postdata = { sesid: self.selectedSes.id };
        $http({ url: "documents-session", method: "post", data: postdata }).success(function (data) {
            self.documents = data;
        });
    };

    self.shared.updateDocuments = self.requestDocuments;

    self.deleteDocument = function (docid) {
        var postdata = { docid: docid };
        $http({ url: "delete-document", method: "post", data: postdata }).success(function (data) {
            self.requestDocuments();
        });
    };

    self.requestQuestions = function () {
        var postdata = { sesid: self.selectedSes.id };
        $http({ url: "questions-session", method: "post", data: postdata }).success(function (data) {
            self.questions = data.map(function (e) {
                e.options = e.options.split("\n");
                return e;
            });
        });
        $http({ url: "get-question-text", method: "post", data: postdata }).success(function (data) {
            self.questionTexts = data;
        });
    };

    self.requestSemDocuments = function () {
        var postdata = { sesid: self.selectedSes.id };
        $http({ url: "semantic-documents", method: "post", data: postdata }).success(function (data) {
            self.semDocs = data;
        });
    };

    self.getNewUsers = function () {
        var postdata = { sesid: self.selectedSes.id };
        $http({ url: "get-new-users", method: "post", data: postdata }).success(function (data) {
            self.newUsers = data;
        });
    };

    self.getMembers = function () {
        var postdata = { sesid: self.selectedSes.id };
        $http({ url: "get-ses-users", method: "post", data: postdata }).success(function (data) {
            self.usersArr = data;
            self.users = {};
            data.forEach(function (d) {
                self.users[d.id] = d;
            });
        });
    };

    self.openNewSes = function () {
        $uibModal.open({
            templateUrl: "templ/new-ses.html"
        });
    };

    self.openDuplicateSes = function () {
        if (self.selectedSes == null) return;
        var ses = angular.copy(self.selectedSes);
        $uibModal.open({
            templateUrl: "templ/duplicate-ses.html",
            controller: "DuplicateSesModalController",
            controllerAs: "vm",
            scope: self,
            resolve: {
                data: function data() {
                    return ses;
                }
            }
        });
    };

    self.openDuplicateSesSpec = function (sesr, $event) {
        $event.stopPropagation();
        var ses = angular.copy(sesr);
        $uibModal.open({
            templateUrl: "templ/duplicate-ses.html",
            controller: "DuplicateSesModalController",
            controllerAs: "vm",
            scope: self,
            resolve: {
                data: function data() {
                    return ses;
                }
            }
        });
    };

    self.toggleSidebar = function () {
        self.openSidebar = !self.openSidebar;
        self.shared.updateState();
    };

    self.updateLang = function (lang) {
        $http.get("data/" + lang + ".json").success(function (data) {
            window.DIC = data;
        });
    };

    self.shared.resetSesId = function () {
        self.selectedId = -1;
    };

    self.changeLang = function () {
        self.lang = self.lang == "english" ? "spanish" : "english";
        self.updateLang(self.lang);
    };

    self.generateCode = function () {
        var postdata = {
            id: self.selectedSes.id
        };
        $http.post("generate-session-code", postdata).success(function (data) {
            if (data.code != null) self.selectedSes.code = data.code;
        });
    };

    self.flang = function (key) {
        return $filter("lang")(key);
    };

    self.init();
});

adpp.controller("TabsController", function ($scope, $http, Notification) {
    var self = $scope;
    self.tabOptions = [];
    self.tabConfig = ["users", "groups"];
    self.selectedTab = '';
    self.archivedTab = false;
    self.stages = [];

    self.shared.resetTab = function () {
        self.selectedTab = "editor";
        if (self.selectedSes != null && self.selectedSes.status > 1) {
            self.selectedTab = "dashboard";
        }
        self.selectedTabConfig = -1;
        if (self.selectedSes.status == 7) {
            self.shared.gotoRubrica();
        }
    };

    self.shared.verifyTabs = function () {
        if (self.selectedSes.type == "L") {
            self.iterationNames = [{ name: "reading", val: 0 }, { name: "individual", val: 1 }, { name: "anon", val: 2 }, { name: "teamWork", val: 3 }, { name: "report", val: 4 }, { name: "rubricCalib", val: 5 }, { name: "pairEval", val: 6 }];
            self.tabOptions = ["editor", "users", "groups", "rubrica", "dashboard"];
            self.sesStatusses = ["configuration", "reading", "individual", "anon", "teamWork", "report", "rubricCalib", "pairEval", "finished"];
            self.shared.getRubrica();
            self.shared.getExampleReports();
            self.shared.getReports();
        } else if (self.selectedSes.type == "S") {
            self.iterationNames = [{ name: "individual", val: 1 }, { name: "anon", val: 2 }, { name: "teamWork", val: 3 }];
            self.tabOptions = ["editor", "users", "groups", "dashboard"];
            self.sesStatusses = ["configuration", "individual", "anon", "teamWork", "finished"];
        } else if (self.selectedSes.type == "M") {
            self.iterationNames = [{ name: "individual", val: 1 }, { name: "teamWork", val: 3 }, { name: "report", val: 4 }, { name: "pairEval", val: 6 }];
            self.tabOptions = ["editor", "users", "groups", "rubrica", "dashboard"];
            self.sesStatusses = [{ i: -1, name: "configuration" }, { i: 1, name: "individual" }, { i: 3, name: "teamWork" }, { i: 4, name: "report" }, { i: 6, name: "pairEval" }, { i: 7, name: "finished" }];
            self.shared.getRubrica();
            self.shared.getExampleReports();
            self.shared.getReports();
        } else if (self.selectedSes.type == "E") {
            self.iterationNames = [{ name: "individual", val: 1 }, { name: "anon", val: 2 }, { name: "teamWork", val: 3 }];
            self.tabOptions = ["editor", "users", "groups", "dashboard"];
            self.sesStatusses = ["configuration", "individual", "anon", "teamWork", "finished"];
        } else if (self.selectedSes.type == "R" || self.selectedSes.type == "T" || self.selectedSes.type == "J") {
            self.iterationNames = [];
            self.tabOptions = ["editor", "users", "dashboard"];
            // self.sesStatusses = ["configuration"];
            var pd = {
                sesid: self.selectedSes.id
            };
            $http({ url: "get-admin-stages", method: "post", data: pd }).success(function (data) {
                self.stages = data;
                data.forEach(st => {
                    self.iterationNames.push({name: self.flang("stage") + " " + st.number, val: st.id});
                });
            });
        }
        if (self.selectedSes.status > 1) {
            self.selectedTab = "dashboard";
        }
    };

    self.setTab = function (idx) {
        self.selectedTab = idx;
    };

    self.setTabConfig = function (idx) {
        self.selectedTabConfig = idx;
    };

    self.backToList = function () {
        self.shared.resetSesId();
        self.tabOptions = [];
        self.selectedTab = "";
    };

    self.shared.gotoGrupos = function () {
        self.selectedTab = "groups";
    };

    self.shared.gotoRubrica = function () {
        self.selectedTab = "rubrica";
    };

    self.archTab = function(v){
        self.archivedTab = v;
    };

    self.currentSessions = function(){
        return self.sessions.filter(e => !!e.archived == self.archivedTab);
    };

    self.archiveSes = function(ses, $event){
        $event.stopPropagation();
        var postdata = { sesid: ses.id, val: true };
        $http({ url: "archive-session", method: "post", data: postdata }).success(function (data) {
            Notification.info("Sesión archivada");
            ses.archived = true;
        });
    };

    self.restoreSes = function(ses, $event){
        $event.stopPropagation();
        var postdata = { sesid: ses.id, val: false };
        $http({ url: "archive-session", method: "post", data: postdata }).success(function (data) {
            Notification.info("Sesión restaurada");
            ses.archived = false;
        });
    };

});

adpp.controller("DocumentsController", function ($scope, $http, Notification, $timeout) {
    var self = $scope;

    self.busy = false;
    self.dfs = [];
    self.shared.dfs = self.dfs;

    self.getDifferentials = function () {
        $http.post("differentials", { sesid: self.selectedSes.id }).success(function (data) {
            data.forEach(function (df) {
                df.name = df.title;
                self.dfs[df.orden] = df;
            });
        });
    };

    self.uploadDocument = function (event) {
        self.busy = true;
        var fd = new FormData(event.target);
        $http.post("upload-file", fd, {
            transformRequest: angular.identity,
            headers: { 'Content-Type': undefined }
        }).success(function (data) {
            if (data.status == "ok") {
                $timeout(function () {
                    Notification.success("Documento cargado correctamente");
                    event.target.reset();
                    self.busy = false;
                    self.shared.updateDocuments();
                }, 2000);
            }
        });
    };

    self.sendDFS = function () {
        let k = 0;
        self.misc.dfSending = true;
        self.dfs.forEach(function (df, i) {
            let url = df.id ? "update-differential" : "add-differential";
            df.orden = i;
            df.sesid = self.selectedSes.id;
            $http.post(url, df).success(function (data) {
                k += 1;
                if (k == self.dfs.length - 1) {
                    Notification.success("Diferenciales guardados correctamente");
                    self.misc.dfSending = false;
                    self.getDifferentials();
                }
            });
        });
    };

    self.shared.sendDFS = self.sendDFS;

    self.getDifferentials();
});

adpp.controller("SesEditorController", function ($scope, $http, Notification) {
    var self = $scope;

    self.mTransition = { 1: 3, 3: 5, 5: 6, 6: 8, 8: 9 };

    self.splitDescr = false;
    self.splDes1 = "";
    self.splDes2 = "";

    self.toggleSplit = function () {
        self.splitDescr = !self.splitDescr;
        if (self.splitDescr) {
            self.splDes1 = self.selectedSes.descr.split("\n")[0];
            self.splDes2 = self.selectedSes.descr.split("\n")[1] || "";
        } else {
            self.selectedSes.descr = self.splDes1 + "\n" + self.splDes2;
        }
    };

    self.updateSession = function () {
        if (self.splitDescr) {
            self.selectedSes.descr = self.splDes1 + "\n" + self.splDes2;
        }
        if (self.selectedSes.name.length < 3 || self.selectedSes.descr.length < 5) {
            Notification.error("Datos de la sesión incorrectos o incompletos");
            return;
        }
        var postdata = { name: self.selectedSes.name, descr: self.selectedSes.descr, id: self.selectedSes.id };
        $http({ url: "update-session", method: "post", data: postdata }).success(function (data) {
            console.log("Session updated");
        });
    };

    self.shared.changeState = function () {
        if (self.selectedSes.type != "M" && self.selectedSes.status >= self.sesStatusses.length) {
            Notification.error("La sesión está finalizada");
            return;
        }
        if (self.selectedSes.type == "M" && self.selectedSes.status >= 9) {
            Notification.error("La sesión está finalizada");
            return;
        }
        if (self.selectedSes.type == "L" && self.selectedSes.status >= 3 && !self.selectedSes.grouped || self.selectedSes.type == "M" && self.selectedSes.status >= 3 && !self.selectedSes.grouped || self.selectedSes.type == "E" && self.selectedSes.status >= 2 && !self.selectedSes.grouped || self.selectedSes.type == "S" && self.selectedSes.status >= 2 && !self.selectedSes.grouped) {
            self.shared.gotoGrupos();
            Notification.error("Los grupos no han sido generados");
            return;
        }
        if (self.selectedSes.type == "L" && self.selectedSes.status >= 6 && self.shared.isRubricaSet && !self.shared.isRubricaSet() || self.selectedSes.type == "M" && self.selectedSes.status >= 5 && self.shared.isRubricaSet && !self.shared.isRubricaSet()) {
            self.shared.gotoRubrica();
            Notification.error("La rúbrica no ha sido asignada");
            return;
        }
        if (self.selectedSes.type == "L" && self.selectedSes.status >= 7 && (self.selectedSes.paired == null || self.selectedSes.paired == 0) || self.selectedSes.type == "M" && self.selectedSes.status >= 6 && (self.selectedSes.paired == null || self.selectedSes.paired == 0)) {
            self.shared.gotoRubrica();
            Notification.error("Los pares para la evaluación de pares no han sido asignados");
            return;
        }
        if(self.selectedSes.type == "E" && self.selectedSes.status == 0){
            self.shared.sendDFS();
        }
        var confirm = window.confirm("¿Esta seguro que quiere ir al siguiente estado?");
        if (confirm) {
            if (self.selectedSes.type == "M") {
                var postdata = { sesid: self.selectedSes.id, state: self.mTransition[self.selectedSes.status] || self.selectedSes.status };
                $http({ url: "force-state-session", method: "post", data: postdata }).success(function (data) {
                    self.shared.updateSesData();
                });
            } else {
                if (self.selectedSes.status == 1) {
                    self.updateSession();
                    if (self.selectedSes.type == "S") {
                        self.shared.saveConfs();
                    }
                }
                var _postdata = { sesid: self.selectedSes.id };
                $http({ url: "change-state-session", method: "post", data: _postdata }).success(function (data) {
                    self.shared.updateSesData();
                });
            }
        }
    };

    /*self.exportData = () => {
        let postdata = {id: self.selectedSes.id};
        $http.post("export-session-data-sel", postdata).success((data) => {
            let anchor = angular.element('<a/>');
            anchor.attr({
                href: 'data:attachment/vnd.openxmlformats,' + encodeURI(data),
                target: '_blank',
                download: 'resultados.xlsx'
            })[0].click();
        });
    }*/
});

adpp.controller("NewUsersController", function ($scope, $http, Notification) {
    var self = $scope;
    var newMembs = [];

    self.addToSession = function () {
        if (self.newMembs.length == 0) {
            Notification.error("No hay usuarios seleccionados para agregar");
            return;
        }
        var postdata = {
            users: self.newMembs.map(function (e) {
                return e.id;
            }),
            sesid: self.selectedSes.id
        };
        $http({ url: "add-ses-users", method: "post", data: postdata }).success(function (data) {
            if (data.status == "ok") {
                self.refreshUsers();
            }
        });
    };

    self.removeUser = function (uid) {
        if (self.selectedSes.status <= 2) {
            var postdata = { uid: uid, sesid: self.selectedSes.id };
            $http({ url: "delete-ses-user", method: "post", data: postdata }).success(function (data) {
                if (data.status == "ok") {
                    self.refreshUsers();
                }
            });
        }
    };

    self.refreshUsers = function () {
        self.getNewUsers();
        self.getMembers();
    };

    self.shared.refreshUsers = self.refreshUsers;
});

adpp.controller("SemDocController", function ($scope, $http, Notification) {
    var self = $scope;

    self.newSDoc = { id: null, title: "", content: "" };

    self.addSemDoc = function () {
        var postdata = { sesid: self.selectedSes.id, title: self.newSDoc.title, content: self.newSDoc.content };
        $http({ url: "add-semantic-document", method: "post", data: postdata }).success(function (data) {
            if (data.status == "ok") {
                self.requestSemDocuments();
                Notification.success("Texto agregado correctamente");
                self.newSDoc = { id: null, title: "", content: "" };
            }
        });
    };

    self.deleteText = function (id) {
        var postdata = { id: id };
        $http.post("delete-semantic-document", postdata).success(function (data) {
            if (data.status == "ok") {
                self.requestSemDocuments();
                Notification.success("Texto eliminado correctamente");
            }
        });
    };

    self.startEditText = function (tx) {
        self.newSDoc = { id: tx.id, title: tx.title, content: tx.content };
        Notification.info("Edite el texto en el formulario");
    };

    self.updateSemDoc = function () {
        if (self.newSDoc.id == null) {
            Notification.error("No hay texto a editar.");
            return;
        }
        var postdata = { id: self.newSDoc.id, sesid: self.selectedSes.id, title: self.newSDoc.title, content: self.newSDoc.content };
        $http({ url: "update-semantic-document", method: "post", data: postdata }).success(function (data) {
            if (data.status == "ok") {
                self.requestSemDocuments();
                Notification.success("Texto editado correctamente.");
                self.newSDoc = { id: null, title: "", content: "" };
            }
        });
    };
});

adpp.controller("QuestionsController", function ($scope, $http, Notification, $uibModal, NgMap, $timeout) {
    var self = $scope;

    self.qsLabels = ['A', 'B', 'C', 'D', 'E'];

    self.newQuestion = {
        id: null,
        content: "",
        alternatives: ["", "", "", "", ""],
        comment: "",
        other: "",
        textid: null,
        answer: -1
    };

    self.newText = { id: null, title: "", content: "" };

    self.newQsExp = false;

    self.startNewQuestion = function () {
        self.newQuestion = {
            id: null,
            content: "",
            alternatives: ["", "", "", "", ""],
            comment: "",
            other: "",
            textid: null,
            answer: -1
        };
        self.newQsExp = true;
        self.shared.closePrevMapData();
    };

    /*NgMap.getMap().then((map) => {
        console.log("MAP correctly loaded");
        self.map = map;
    });*/

    self.selectAnswer = function (i) {
        self.newQuestion.answer = i;
    };

    self.addQuestion = function () {
        if (self.newQuestion.answer == -1) {
            Notification.error("Debe indicar la respuesta correcta a la pregunta");
            return;
        }
        if (self.newQuestion.alternatives[0] == "" || self.newQuestion.alternatives[1] == "") {
            Notification.error("Debe ingresar al menos 2 alternativas");
            return;
        }
        if (self.newQuestion.alternatives.some(function (e, i) {
            return self.newQuestion.alternatives.indexOf(e) != i;
        })) {
            Notification.error("Hay alternativas duplicadas");
            return;
        }
        if (self.newQuestion.comment == "") {
            Notification.error("Debe ingresar un comentario para la pregunta");
            return;
        }
        if (self.newQuestion.includesMap) {
            encodeMapPlugin();
        }
        var postdata = {
            content: self.newQuestion.content,
            options: self.newQuestion.alternatives.join("\n"),
            comment: self.newQuestion.comment,
            answer: self.newQuestion.answer,
            sesid: self.selectedSes.id,
            textid: self.newQuestion.textid,
            other: self.newQuestion.other,
            pluginData: self.newQuestion.pluginData
        };
        $http({ url: "add-question", method: "post", data: postdata }).success(function (data) {
            if (data.status == "ok") {
                self.requestQuestions();
                Notification.success("Pregunta agrgada correctamente");
                self.newQuestion = {
                    id: null,
                    content: "",
                    alternatives: ["", "", "", "", ""],
                    comment: "",
                    other: "",
                    textid: null,
                    answer: -1
                };
                if (self.shared.sendOverlayBuffer) self.shared.sendOverlayBuffer(data.id);
                self.newQsExp = false;
            }
        });
    };

    self.updateQuestion = function () {
        if (self.newQuestion.id == null) {
            Notification.error("No hay pregunta para editar");
            return;
        }
        if (self.newQuestion.answer == -1) {
            Notification.error("Debe indicar la respuesta correcta a la pregunta");
            return;
        }
        if (self.newQuestion.includesMap) {
            encodeMapPlugin();
        }
        var postdata = {
            id: self.newQuestion.id,
            content: self.newQuestion.content,
            options: self.newQuestion.alternatives.join("\n"),
            comment: self.newQuestion.comment,
            answer: self.newQuestion.answer,
            sesid: self.selectedSes.id,
            textid: self.newQuestion.textid,
            other: self.newQuestion.other,
            pluginData: self.newQuestion.pluginData
        };
        $http({ url: "update-question", method: "post", data: postdata }).success(function (data) {
            if (data.status == "ok") {
                self.requestQuestions();
                Notification.success("Pregunta editada correctamente");
                self.newQuestion = {
                    id: null,
                    content: "",
                    alternatives: ["", "", "", "", ""],
                    comment: "",
                    other: "",
                    textid: null,
                    answer: -1
                };
                if (self.shared.sendOverlayBuffer) self.shared.sendOverlayBuffer(postdata.id);
                self.newQsExp = false;
            }
        });
    };

    self.startEditQuestion = function (qs) {
        self.questions.forEach(function (qs) {
            return qs.expanded = false;
        });
        self.newQuestion = {
            id: qs.id,
            content: qs.content,
            alternatives: qs.options,
            comment: qs.comment,
            other: qs.other,
            textid: qs.textid,
            answer: qs.answer,
            includesMap: qs.plugin_data && qs.plugin_data.startsWith("MAP")
        };
        Notification.info("Edite la pregunta en el formulario.");
        if (self.newQuestion.includesMap) {
            if (self.shared.clearOverlayBuffer) self.shared.clearOverlayBuffer();
            self.shared.processMapData(qs.plugin_data, qs.id);
            futureRefreshMap();
        }
        self.newQsExp = true;
    };

    self.startEditText = function (tx) {
        self.newText = {
            id: tx.id,
            title: tx.title,
            content: tx.content
        };
        Notification.info("Edite el texto en el formulario.");
        self.newTextExp = true;
    };

    self.addQuestionText = function () {
        var postdata = { sesid: self.selectedSes.id, title: self.newText.title, content: self.newText.content };
        $http({ url: "add-question-text", method: "post", data: postdata }).success(function (data) {
            if (data.status == "ok") {
                self.requestQuestions();
                self.newText = { id: null, title: "", content: "" };
                self.newTextExp = false;
            }
        });
    };

    self.updateQuestionText = function () {
        if (self.newText.id == null) {
            Notification.error("No hay texto para editar");
            return;
        }
        var postdata = { id: self.newText.id, sesid: self.selectedSes.id, title: self.newText.title, content: self.newText.content };
        $http({ url: "update-question-text", method: "post", data: postdata }).success(function (data) {
            if (data.status == "ok") {
                self.requestQuestions();
                self.newText = { title: "", content: "" };
                self.newTextExp = false;
            }
        });
    };

    self.deleteQuestion = function (id) {
        var postdata = { id: id };
        $http.post("delete-question", postdata).success(function (data) {
            self.requestQuestions();
            self.newQuestion = {
                id: null,
                content: "",
                alternatives: ["", "", "", "", ""],
                comment: "",
                other: "",
                textid: null,
                answer: -1
            };
            Notification.success("Pregunta eliminada correctamente");
        });
    };

    self.deleteQuestionText = function (id) {
        var postdata = { id: id };
        $http.post("delete-question-text", postdata).success(function (data) {
            self.requestQuestions();
            Notification.success("Texto eliminado correctamente");
        });
    };

    self.configQuillExtra = function (editor) {
        self.editor = editor;
    };

    self.toggleMapPlugin = function () {
        self.newQuestion.includesMap = !self.newQuestion.includesMap;
        if (self.newQuestion.includesMap) {
            futureRefreshMap();
        }
    };

    self.expandQuestion = function (qs) {
        if (qs.expanded) {
            qs.expanded = false;
            self.shared.closePrevMapData();
        } else {
            self.questions.forEach(function (qs) {
                return qs.expanded = false;
            });
            qs.expanded = true;
            if (qs.plugin_data && qs.plugin_data.startsWith("MAP")) {
                self.shared.processPrevMapData(qs.plugin_data, qs.id);
            }
        }
    };

    var futureRefreshMap = function futureRefreshMap() {
        $timeout(function () {
            var map = self.shared.getActiveMap();
            google.maps.event.trigger(map, "resize");
        }, 1000);
    };

    var encodeMapPlugin = function encodeMapPlugin() {
        var r = self.shared.getPluginMapOptions();
        var map = self.shared.getActiveMap();
        if (map == null) {
            /*NgMap.getMap().then((map) => {
                console.log("MAP correctly loaded");
                self.map = map;
                let lat = self.map.getCenter().lat();
                let lng = self.map.getCenter().lng();
                let zoom = self.map.getZoom();
                self.newQuestion.pluginData = "MAP " + lat + " " + lng + " " + zoom + (r.nav ? " NAV" : "") + (r.edit ? " EDIT" : "");
            }, (err) => {*/
            Notification.error("Ocurrio un error al cargar los datos del mapa, intente nuevamente.");
            //});
            return;
        }
        var lat = map.getCenter().lat();
        var lng = map.getCenter().lng();
        var zoom = map.getZoom();
        self.newQuestion.pluginData = "MAP " + lat + " " + lng + " " + zoom + (r.nav ? " NAV" : "") + (r.edit ? " EDIT" : "");
    };
});

adpp.controller("DashboardController", function ($scope, $http, $timeout, $uibModal, Notification) {
    var self = $scope;
    self.iterationIndicator = 1;
    self.currentTimer = null;
    self.showCf = false;
    self.dataDF = [];
    self.dataChatCount = {};

    self.shared.resetGraphs = function () {
        if (self.selectedSes != null && self.selectedSes.type == "L") {
            self.iterationIndicator = Math.max(Math.min(6, self.selectedSes.status - 2), 0);
        } else if (self.selectedSes.type == "S") {
            self.iterationIndicator = Math.max(Math.min(3, self.selectedSes.status - 1), 1);
        } else if (self.selectedSes.type == "M") {
            self.iterationIndicator = Math.max(Math.min(6, self.selectedSes.status - 2), 0);
        }
        else if (self.selectedSes.type == "R" || self.selectedSes.type == "T" || self.selectedSes.type == "J") {
            self.iterationIndicator = self.selectedSes.current_stage;
        }
        self.alumState = null;
        self.barOpts = {
            chart: {
                type: 'multiBarChart',
                height: 320,
                x: function x(d) {
                    return d.label;
                },
                y: function y(d) {
                    return d.value;
                },
                showControls: false,
                showValues: false,
                duration: 500,
                xAxis: {
                    showMaxMin: false
                },
                yAxis: {
                    axisLabel: self.flang('students')
                }
            }
        };
        self.barData = [{ key: self.flang('students'), color: "#0077c1", values: [] }];
        self.updateState();
        if (DASHBOARD_AUTOREALOD && self.selectedSes.status < 9) {
            self.reload(true);
        }
    };

    self.reload = function (k) {
        if (!k) {
            self.updateState();
        }
        if (self.currentTimer != null) {
            $timeout.cancel(self.currentTimer);
        }
        self.currentTimer = $timeout(self.reload, DASHBOARD_AUTOREALOD_TIME * 1000);
    };

    self.updateState = function () {
        if (self.selectedSes.status == 1) {
            self.shared.refreshUsers();
        }
        else if (self.iterationIndicator <= 4 || self.selectedSes.type == "R" || self.selectedSes.type == "T" || self.selectedSes.type == "J") {
            self.updateStateIni();
        }
        else {
            self.updateStateRub();
        }
    };

    self.shared.updateState = self.updateState;

    self.updateStateIni = function () {
        self.alumTime = {};
        var postdata = { sesid: self.selectedSes.id, iteration: self.iterationIndicator };
        if (self.selectedSes.type == "S") {
            $http({ url: "get-alum-full-state-sel", method: "post", data: postdata }).success(function (data) {
                self.alumState = {};
                for (var uid in self.users) {
                    if (self.users[uid].role == "A") self.alumState[uid] = {};
                }
                data.forEach(function (d) {
                    if (self.alumState[d.uid] == null) {
                        self.alumState[d.uid] = {};
                        self.alumState[d.uid][d.qid] = d.correct;
                    } else {
                        self.alumState[d.uid][d.qid] = d.correct;
                    }
                });
                if (self.iterationIndicator == 3) {
                    $http({
                        url: "get-original-leaders",
                        method: "post",
                        data: { sesid: self.selectedSes.id }
                    }).success(function (data) {
                        var temp = angular.copy(self.alumState);
                        self.alumState = {};
                        self.leaderTeamStr = {};
                        self.leaderTeamId = {};
                        data.forEach(function (r) {
                            self.alumState[r.leader] = temp[r.leader];
                            self.leaderTeamStr[r.leader] = r.team.map(function (u) {
                                return self.users[u] ? self.users[u].name : "- ";
                            }).join(", ");
                            self.leaderTeamId[r.leader] = r.id;
                        });
                    });
                }
                self.shared.alumState = self.alumState;
            });
            $http({ url: "get-alum-state-sel", method: "post", data: postdata }).success(function (data) {
                var dataNorm = data.map(function (d) {
                    d.score /= self.questions.length;
                    return d;
                });
                self.buildBarData(dataNorm);
            });
            $http({ url: "get-alum-confidence", method: "post", data: postdata }).success(function (data) {
                self.confidence = {};
                data.forEach(function (r) {
                    if (!self.confidence[r.qid]) self.confidence[r.qid] = {};
                    self.confidence[r.qid][r.conf] = r.freq;
                });
            });
        }
        else if (self.selectedSes.type == "L") {
            $http({ url: "get-alum-state-lect", method: "post", data: postdata }).success(function (data) {
                self.alumState = {};
                for (var uid in self.users) {
                    if (self.users[uid].role == "A") self.alumState[uid] = {};
                }
                data.forEach(function (d) {
                    if (self.alumState[d.uid] == null) {
                        self.alumState[d.uid] = d;
                    } else {
                        self.alumState[d.uid] = d;
                    }
                });
                self.buildBarData(data);
                self.getAlumDoneTime(postdata);
                if (self.iterationIndicator == 3) {
                    $http({ url: "get-original-leaders", method: "post", data: { sesid: self.selectedSes.id } }).success(function (data) {
                        var temp = angular.copy(self.alumState);
                        self.alumState = {};
                        self.leaderTeamStr = {};
                        data.forEach(function (r) {
                            self.alumState[r.leader] = temp[r.leader];
                            self.leaderTeamStr[r.leader] = r.team.map(function (u) {
                                return self.users[u] ? self.users[u].name : "- ";
                            }).join(", ");
                        });
                    });
                }
                self.shared.alumState = self.alumState;
            });
            $http({ url: "get-ideas-progress", method: "post", data: postdata }).success(function (data) {
                self.numProgress = 0;
                self.numUsers = Object.keys(self.users).length - 1;
                var n = self.documents.length * 3;
                if (n != 0) {
                    data.forEach(function (d) {
                        self.numProgress += d.count / n;
                    });
                    self.numProgress *= 100 / self.numUsers;
                }
            });
        }
        else if (self.selectedSes.type == "M") {
            $http({ url: "get-alum-state-semantic", method: "post", data: postdata }).success(function (data) {
                self.alumState = {};
                self.numUsers = 0;
                for (var uid in self.users) {
                    if (self.users[uid].role == "A") {
                        self.alumState[uid] = {};
                        self.numUsers++;
                    }
                }
                data.forEach(function (d) {
                    if (self.alumState[d.uid] == null) {
                        self.alumState[d.uid] = d;
                    } else {
                        self.alumState[d.uid] = d;
                    }
                });
                self.buildBarData(data);
                self.getAlumDoneTime(postdata);
                if (self.iterationIndicator == 3) {
                    $http({ url: "get-original-leaders", method: "post", data: { sesid: self.selectedSes.id } }).success(function (data) {
                        var temp = angular.copy(self.alumState);
                        self.alumState = {};
                        self.leaderTeamStr = {};
                        data.forEach(function (r) {
                            self.alumState[r.leader] = temp[r.leader];
                            self.leaderTeamStr[r.leader] = r.team.map(function (u) {
                                return self.users[u] ? self.users[u].name : "- ";
                            }).join(", ");
                        });
                    });
                }
                self.shared.alumState = self.alumState;
            });
            /*$http({url: "get-ideas-progress", method: "post", data: postdata}).success((data) => {
                self.numProgress = 0;
                self.numUsers = Object.keys(self.users).length - 1;
                let n = self.documents.length * 3;
                if (n != 0) {
                    data.forEach((d) => {
                        self.numProgress += d.count / n;
                    });
                    self.numProgress *= 100 / self.numUsers;
                }
            });*/
        }
        else if (self.selectedSes.type == "E") {
            var _postdata2 = {
                sesid: self.selectedSes.id
            };
            let url = self.selectedSes.grouped ? "get-differential-all" : "get-differential-indv";
            $http.post(url, _postdata2).success(function (data) {
                self.dataDF = [];
                console.log("SELF");
                console.log(self);
                var tmid = -1;
                var i = -1;
                var mapAt = ["", "ind", "anon", "team"];
                data.forEach(function (d) {
                    if (d.tmid != tmid) {
                        i += 1;
                        tmid = d.tmid;
                        let u = d.uid;
                        let glen = 1;
                        if(self.shared.groups) {
                            let g = self.shared.groups.find(e => e.some(f => f.uid == u));
                            glen = g ? g.length : 1;
                        }
                        self.dataDF.push({
                            tmid: tmid,
                            ind: [],
                            anon: [],
                            team: [],
                            glen: glen
                        });
                    }
                    self.dataDF[i][mapAt[d.iteration]].push(d);
                });
                $http.post("get-chat-count", _postdata2).success(function (datachat) {
                    self.dataChatCount = {};
                    datachat.forEach(function (ch) {
                        if (!self.dataChatCount[ch.tmid]) self.dataChatCount[ch.tmid] = {};
                        self.dataChatCount[ch.tmid][ch.orden] = ch.count;
                    });
                });
                self.shared.dataDF = self.dataDF;
            });
        }
        else if (self.selectedSes.type == "R") {
            var _postdata2 = {
                stageid: self.iterationIndicator
            };
            $http.post("get-actors", _postdata2).success(function(data){
                self.rawActors = data;
                self.actorMap = {};
                data.forEach(a => {
                    self.actorMap[a.id] = a;
                });
                $http.post("get-role-sel-all", _postdata2).success(function (data) {
                    self.rawRoleData = data;
                    self.posFreqTable = window.computePosFreqTable(data, self.rawActors);
                    if(self.posFreqTable != null) {
                        self.freqMax = Object.values(self.posFreqTable)
                            .reduce((v, e) => Math.max(v, Object.values(e).reduce((v2, e2) => Math.max(e2, v2), 0)), 0);
                    }
                    self.indvTable = window.computeIndTable(data, self.rawActors);
                    self.shared.roleIndTable = self.indvTable;
                    self.indvTableSorted = window.sortIndTable(self.indvTable, self.users);
                });
                $http({ url: "group-proposal-stage", method: "post", data: _postdata2 }).success(function (data) {
                    self.shared.groupByUid = {};
                    data.forEach(function (s, i) {
                        s.forEach(function (u) {
                            self.shared.groupByUid[u.uid] = { index: i + 1, tmid: u.tmid };
                        });
                    });
                });
                $http({ url: "get-chat-count-stage", method: "post", data: _postdata2 }).success(function (data) {
                    self.shared.chatByUid = {};
                    self.shared.chatByTeam = {};
                    data.forEach(function(c) {
                        self.shared.chatByUid[c.uid] = +c.count;
                        if(!self.shared.chatByTeam[c.tmid]){
                            self.shared.chatByTeam[c.tmid] = 0;
                        }
                        self.shared.chatByTeam[c.tmid] += +c.count;
                    });
                });
            });
        }
        else if (self.selectedSes.type == "T"){
            var _postdata2 = {
                stageid: self.iterationIndicator
            };
            self.dfsStage = [];
            $http.post("get-differentials-stage", _postdata2).success(function(data) {
                self.dfsStage = data;
                $http.post("get-differential-all-stage", _postdata2).success(function (data) {
                    self.shared.difTable = window.buildDifTable(data, self.users, self.dfsStage, self.shared.groupByUid);
                    self.shared.difTableUsers = self.shared.difTable.filter(e => !e.group).length;
                });
            });
            $http({ url: "group-proposal-stage", method: "post", data: _postdata2 }).success(function (data) {
                self.shared.groupByUid = {};
                self.shared.groupByTmid = {};
                data.forEach(function (s, i) {
                    s.forEach(function (u) {
                        self.shared.groupByUid[u.uid] = { index: i + 1, tmid: u.tmid };
                        self.shared.groupByTmid[u.tmid] = { index: i + 1, tmid: u.tmid };
                    });
                });
            });
            $http({ url: "get-dif-chat-count", method: "post", data: _postdata2 }).success(function (data) {
                self.shared.chatByUid = {};
                self.shared.chatByTeam = {};
                data.forEach(function(c) {
                    if(!self.shared.chatByUid[c.did])
                        self.shared.chatByUid[c.did] = {};
                    self.shared.chatByUid[c.did][c.uid] = +c.count;
                    if(!self.shared.chatByTeam[c.did])
                        self.shared.chatByTeam[c.did] = {};
                    if(!self.shared.chatByTeam[c.did][c.tmid]){
                        self.shared.chatByTeam[c.did][c.tmid] = 0;
                    }
                    self.shared.chatByTeam[c.did][c.tmid] += +c.count;
                });
            });
        }
        else if (self.selectedSes.type == "J"){
            var _postdata2 = {
                stageid: self.iterationIndicator
            };
            if(self.shared.inputAssignedRoles) {
                self.shared.inputAssignedRoles();
            }
            $http.post("get-actors", _postdata2).success(function(data){
                self.rawActors = data;
                self.actorMap = {};
                data.forEach(a => {
                    self.actorMap[a.id] = a;
                });
                $http.post("get-role-sel-all", _postdata2).success(function (data) {
                    self.rawRoleData = data;
                    self.posFreqTable = window.computePosFreqTable(data, self.rawActors);
                    if(self.posFreqTable != null) {
                        self.freqMax = Object.values(self.posFreqTable)
                            .reduce((v, e) => Math.max(v, Object.values(e).reduce((v2, e2) => Math.max(e2, v2), 0)), 0);
                    }
                    self.indvTable = window.computeIndTable(data, self.rawActors);
                    self.shared.roleIndTable = self.indvTable;
                    self.indvTableSorted = window.sortIndTable(self.indvTable, self.users);
                });
                $http({ url: "group-proposal-stage", method: "post", data: _postdata2 }).success(function (data) {
                    self.shared.groupByUid = {};
                    data.forEach(function (s, i) {
                        s.forEach(function (u) {
                            self.shared.groupByUid[u.uid] = { index: i + 1, tmid: u.tmid };
                        });
                    });
                });
                $http({ url: "get-chat-count-stage", method: "post", data: _postdata2 }).success(function (data) {
                    self.shared.chatByUid = {};
                    self.shared.chatByTeam = {};
                    data.forEach(function(c) {
                        self.shared.chatByUid[c.uid] = +c.count;
                        if(!self.shared.chatByTeam[c.tmid]){
                            self.shared.chatByTeam[c.tmid] = 0;
                        }
                        self.shared.chatByTeam[c.tmid] += +c.count;
                    });
                });
            });
        }
    };

    self.getFreqColor = function(aid, pos){
        if(self.posFreqTable && self.posFreqTable[aid]) {
            let val = self.posFreqTable[aid][pos] || 0;
            let p = val / self.freqMax;

            return {
                "background": "rgba(0, 184, 166, " + p + ")"
            }
        }
    };

    self.avgAlum = function (uid) {
        if (self.alumState != null && self.alumState[uid] != null) {
            var t = 0;
            var c = 0;
            for (var k in self.alumState[uid]) {
                if (self.alumState[uid][k]) c++;
                t++;
            }
            return t > 0 ? 100 * c / t : 0;
        }
        return 0;
    };

    self.avgPreg = function (pid) {
        if (self.alumState != null) {
            var t = 0;
            var c = 0;
            for (var k in self.alumState) {
                if (self.alumState[k] != null && self.alumState[k][pid] != null) {
                    if (self.alumState[k][pid]) c++;
                    t++;
                }
            }
            return t > 0 ? 100 * c / t : 0;
        }
        return 0;
    };

    self.avgAll = function () {
        var t = 0;
        var c = 0;
        if (self.alumState != null) {
            for (var u in self.alumState) {
                for (var k in self.alumState[u]) {
                    if (self.alumState[u][k]) c++;
                    t++;
                }
            }
        }
        return t > 0 ? 100 * c / t : 0;
    };

    self.progress = function () {
        var t = 0;
        if (self.alumState != null) {
            for (var u in self.alumState) {
                for (var k in self.alumState[u]) {
                    t++;
                }
            }
            return 100 * t / (Object.keys(self.alumState).length * self.questions.length);
        }
        return 0;
    };

    self.progressAlum = function (uid) {
        var t = 0;
        if (self.alumState != null && self.alumState[uid] != null) {
            for (var k in self.alumState[uid]) {
                t++;
            }
            return 100 * t / self.questions.length;
        }
        return 0;
    };

    self.progressPreg = function (pid) {
        var t = 0;
        if (self.alumState != null) {
            for (var u in self.alumState) {
                if (self.alumState[u][pid] != null) {
                    t++;
                }
            }
            return 100 * t / Object.keys(self.alumState).length;
        }
        return 0;
    };

    self.lectPerformance = function () {
        var t = 0;
        var c = 0;
        if (self.alumState != null) {
            for (var u in self.alumState) {
                var a = self.alumState[u];
                t++;
                c += a.score;
            }
            return 100 * c / t;
        }
        return 0;
    };

    self.DFAll = function (ans, orden) {
        return ans.filter(function (e) {
            return e.orden == orden;
        }).map(function (e) {
            return e.sel;
        });
    };

    self.DFL = function (ans, orden) {
        return ans.filter(function (e) {
            return e.orden == orden;
        }).length;
    };

    self.DFAvg = function (ans, orden) {
        var a = ans.filter(function (e) {
            return e.orden == orden;
        }).map(function (e) {
            return e.sel;
        });
        return a.length > 0 ? a.reduce(function (v, e) {
            return v + e;
        }, 0) / a.length : 0;
    };

    self.DFMinMax = function (ans, orden) {
        var a = ans.filter(function (e) {
            return e.orden == orden;
        }).map(function (e) {
            return e.sel;
        });
        a.sort();
        var n = a.length - 1;
        return a[n] - a[0];
    };

    self.DFColor = function (ans, orden) {
        var avg = self.DFAvg(ans, orden);
        var sd = 0;
        var arr = ans.filter(function (e) {
            return e.orden == orden;
        }).map(function (e) {
            return e.sel;
        });
        arr.forEach(function (a) {
            sd += (a - avg) * (a - avg);
        });
        var dif = Math.sqrt(sd / (arr.length - 1));

        if (dif <= 1) return "bg-darkgreen";
        else if (dif > 2.8) return "bg-red";
        else return "bg-yellow";
    };

    self.getAlumDoneTime = function (postdata) {
        $http({ url: "get-alum-done-time", method: "post", data: postdata }).success(function (data) {
            self.numComplete = 0;
            data.forEach(function (row) {
                self.numComplete += 1;
                if (self.alumState[row.uid] == null) self.alumState[row.uid] = row;else self.alumState[row.uid].dtime = ~~row.dtime;
            });
        });
    };

    self.buildBarData = function (data) {
        var N = 5;
        self.barData[0].values = [];
        for (var i = 0; i < N; i++) {
            var lbl = i * 20 + "% - " + (i + 1) * 20 + "%";
            self.barData[0].values.push({ label: lbl, value: 0 });
        }
        data.forEach(function (d) {
            var rank = Math.min(Math.floor(N * d.score), N - 1);
            self.barData[0].values[rank].value += 1;
        });
        self.barOpts.chart.xAxis.axisLabel = self.flang("performance");
    };

    self.updateStateRub = function () {
        if (self.iterationIndicator == 5) self.computeDif();else if (self.iterationIndicator == 6) self.getAllReportResult();
    };

    self.showName = function (report) {
        if (report.example) return report.title + " - " + self.flang("exampleReport");else return report.id + " - " + self.flang("reportOf") + " " + self.users[report.uid].name;
    };

    self.shared.getReports = function () {
        var postdata = { sesid: self.selectedSes.id };
        $http({ url: "get-report-list", method: "post", data: postdata }).success(function (data) {
            self.reports = data;
            self.exampleReports = data.filter(function (e) {
                return e.example;
            });
        });
    };

    self.getReportResult = function () {
        var postdata = { repid: self.selectedReport.id };
        $http({ url: "get-report-result", method: "post", data: postdata }).success(function (data) {
            self.result = data;
            self.updateState();
        });
    };

    self.getAllReportResult = function () {
        var postdata = { sesid: self.selectedSes.id };
        $http({ url: "get-report-result-all", method: "post", data: postdata }).success(function (data) {
            self.resultAll = {};
            var n = data.length;
            for (var uid in self.users) {
                if (self.users[uid].role == "A") self.resultAll[uid] = { reviews: 0, data: [] };
            }
            data.forEach(function (d) {
                if (d != null && d.length > 0) {
                    var _uid = self.getReportAuthor(d[0].rid);
                    if (_uid != -1 && self.resultAll[_uid].data == null) {
                        self.resultAll[_uid].data = d;
                    } else if (_uid != -1) {
                        self.resultAll[_uid].data = d;
                    }
                    d.forEach(function (ev) {
                        self.resultAll[ev.uid].reviews += n;
                    });
                }
            });
            self.pairArr = data[0] ? new Array(data[0].length) : [];
            //console.log(self.resul);
            self.buildRubricaBarData(data);
        });
    };

    self.buildRubricaBarData = function (data) {
        var N = 3;
        //let rubnms = [self.flang("") + "-" + self.flang(""), "Proceso-Competente", "Competente-Avanzado"];
        var rubnms = ["1 - 2", "2 - 3", "3 - 4"];
        self.barData[0].values = [];
        for (var i = 0; i < N; i++) {
            var lbl = i + 1 + " - " + (i + 2) + " (" + rubnms[i] + ")";
            self.barData[0].values.push({ label: lbl, value: 0 });
        }
        data.forEach(function (d) {
            var score = d.reduce(function (e, v) {
                return e + v.val;
            }, 0) / d.length;
            var rank = Math.min(Math.floor(score - 1), N - 1);
            self.barData[0].values[rank].value += 1;
        });
        self.barOpts.chart.xAxis.axisLabel = self.flang("scoreDist");
    };

    self.computeDif = function () {
        if (self.result) {
            var pi = self.result.findIndex(function (e) {
                return self.users[e.uid].role == 'P';
            });
            if (pi != -1) {
                var pval = self.result[pi].val;
                var difs = [];
                self.result.forEach(function (e, i) {
                    if (i != pi) {
                        difs.push(Math.abs(pval - e.val));
                    }
                });
                self.buildRubricaDiffData(difs);
            }
        }
    };

    self.buildRubricaDiffData = function (difs) {
        console.log("difs", difs);
        var N = 5;
        var lblnms = self.flang("high2lowScale").split(",");
        self.barData[0].values = [];
        for (var i = 0; i < N; i++) {
            // let lbl = (i * 0.5) + " - " + (i + 1) * 0.5;
            self.barData[0].values.push({ label: lblnms[i], value: 0 });
        }
        difs.forEach(function (d) {
            var rank = Math.min(Math.floor(d * 2), N - 1);
            self.barData[0].values[rank].value += 1;
        });
        self.barOpts.chart.xAxis.axisLabel = self.flang("correctDistance");
    };

    self.getReportAuthor = function (rid) {
        if (self.reports) {
            var rep = self.reports.find(function (e) {
                return e.id == rid;
            });
            return rep ? rep.uid : -1;
        }
        return -1;
    };

    self.getAvg = function (row) {
        if (row == null || row.length == 0) return "";
        var s = row.reduce(function (v, e) {
            return v + e.val;
        }, 0);
        return s / row.length;
    };

    self.getInMax = function (res) {
        if (res == null) return [];
        var n = 0;
        for (var u in res) {
            n = Math.max(n, res[u].data.length);
        }
        return new Array(n);
    };

    self.showReport = function (rid) {
        var postdata = { rid: rid };
        $http({ url: "get-report", method: "post", data: postdata }).success(function (data) {
            var modalData = { report: data, criterios: self.shared.obtainCriterios() };
            modalData.report.author = self.users[data.uid];
            var postdata = { repid: data.id };
            $http({ url: "get-report-result", method: "post", data: postdata }).success(function (data) {
                modalData.answers = data;
                $http.post("get-criteria-selection-by-report", postdata).success(function (data) {
                    modalData.answersRubrica = {};
                    data.forEach(function (row) {
                        if (modalData.answersRubrica[row.uid] == null) modalData.answersRubrica[row.uid] = {};
                        modalData.answersRubrica[row.uid][row.cid] = row.selection;
                    });
                    $http.post("get-report-evaluators", postdata).success(function (data) {
                        data.forEach(function (row) {
                            var i = modalData.answers.findIndex(function (e) {
                                return e.uid == row.uid;
                            });
                            if (i == -1) modalData.answers.push({ uid: row.uid, evaluatorName: self.users[row.uid].name });else modalData.answers[i].evaluatorName = self.users[row.uid].name;
                        });
                        $uibModal.open({
                            templateUrl: "templ/report-details.html",
                            controller: "ReportModalController",
                            controllerAs: "vm",
                            size: "lg",
                            scope: self,
                            resolve: {
                                data: function data() {
                                    return modalData;
                                }
                            }
                        });
                    });
                });
            });
        });
    };

    self.showReportByUid = function (uid) {
        console.log(uid);
        var postdata = { uid: uid, sesid: self.selectedSes.id };
        $http({ url: "get-report-uid", method: "post", data: postdata }).success(function (data) {
            var modalData = { report: data };
            modalData.report.author = self.users[uid];
            $uibModal.open({
                templateUrl: "templ/report-details.html",
                controller: "ReportModalController",
                controllerAs: "vm",
                scope: self,
                resolve: {
                    data: function data() {
                        return modalData;
                    }
                }
            });
        });
    };

    self.broadcastReport = function (rid) {
        var postdata = { sesid: self.selectedSes.id, rid: rid };
        $http({ url: "set-eval-report", method: "post", data: postdata }).success(function (data) {
            Notification.success("Reporte enviado a alumnos");
        });
    };

    self.showDetailAnswer = function (qid, uid, it) {
        var opts = ["A", "B", "C", "D", "E"];
        var postdata = { uid: uid, qid: qid, iteration: it };
        var qs = self.questions.reduce(function (e, v) {
            return v.id == qid ? v : e;
        }, null);
        if (it < 3) {
            $http({ url: "get-selection-comment", method: "post", data: postdata }).success(function (_data) {
                if (_data == null || _data.answer == null) {
                    Notification.warning("No hay respuesta registrada para el alumno");
                    return;
                }
                var alt = opts[_data.answer] + ". " + qs.options[_data.answer];
                var qstxt = qs.content;
                $uibModal.open({
                    templateUrl: "templ/content-dialog.html",
                    controller: "ContentModalController",
                    controllerAs: "vm",
                    scope: self,
                    resolve: {
                        data: function data() {
                            _data.title = self.flang("answerOf") + " " + self.users[uid].name;
                            _data.content = self.flang("question") + ":\n" + qstxt + "\n\n" + self.flang("answer") + ":\n" + alt + "\n\n" + self.flang("comment") + ":\n" + (_data.comment ? _data.comment : "");
                            if (_data.confidence) {
                                _data.content += "\n\n" + self.flang("confidenceLevel") + ": " + _data.confidence + "%";
                            }
                            return _data;
                        }
                    }
                });
            });
        } else {
            postdata.tmid = self.leaderTeamId[uid];
            $http({ url: "get-selection-team-comment", method: "post", data: postdata }).success(function (res) {
                if (res == null || res.length == 0) {
                    Notification.warning("No hay respuesta registrada para el grupo");
                    return;
                }
                var alt = opts[res[0].answer] + ". " + qs.options[res[0].answer];
                var qstxt = qs.content;
                $uibModal.open({
                    templateUrl: "templ/content-dialog.html",
                    controller: "ContentModalController",
                    controllerAs: "vm",
                    scope: self,
                    resolve: {
                        data: function data() {
                            var data = {};
                            data.title = self.flang("answerOf") + " " + self.leaderTeamStr[uid];
                            data.content = self.flang("question") + ":\n" + qstxt + "\n\n" + self.flang("answer") + ":\n" + alt + "\n\n";
                            res.forEach(function (r) {
                                data.content += self.flang("comment") + " " + r.uname + ":\n" + (r.comment != null ? r.comment : "") + "\n";
                                if (r.confidence != null) {
                                    data.content += self.flang("confidenceLevel") + ": " + r.confidence + "%\n";
                                }
                                data.content += "\n";
                            });

                            return data;
                        }
                    }
                });
            });
        }
    };

    self.openDFDetails = function (group, orden) {
        var postdata = {
            sesid: self.selectedSes.id,
            tmid: group,
            orden: orden
        };
        $http.post("get-team-chat", postdata).success(function (res) {
            $uibModal.open({
                templateUrl: "templ/differential-group.html",
                controller: "EthicsModalController",
                controllerAs: "vm",
                scope: self,
                resolve: {
                    data: function data() {
                        var data = {};
                        data.names = [self.flang("individual"), self.flang("anon"), self.flang("teamWork")];
                        data.orden = orden;
                        data.group = group;
                        data.users = self.users;
                        var dfgr = self.dataDF.find(function (e) {
                            return e.tmid == group;
                        });
                        // console.log(self.shared);
                        if (dfgr.ind.some(function (e) {
                            return e.orden == orden;
                        })) {
                            var dfgri = dfgr.ind.find(function (e) {
                                return e.orden == orden;
                            });
                            data.master = self.shared.dfs.filter(function (e) {
                                return e.id;
                            }).find(function (e) {
                                return e.id == dfgri.did;
                            });
                        }
                        data.dfIters = [];
                        data.dfIters.push(dfgr.ind.filter(function (e) {
                            return e.orden == orden;
                        }));
                        data.dfIters.push(dfgr.anon.filter(function (e) {
                            return e.orden == orden;
                        }));
                        data.dfIters.push(dfgr.team.filter(function (e) {
                            return e.orden == orden;
                        }));
                        data.anonNames = {};
                        data.sesid = self.selectedSes.id;
                        var abcd = "ABCD";
                        var c = 0;
                        data.dfIters.flat().forEach(function (e) {
                            if (!data.anonNames[e.uid]) {
                                data.anonNames[e.uid] = abcd[c];
                                c++;
                            }
                        });
                        data.chat = res;
                        data.chat.forEach(function (msg) {
                            if (msg.parent_id) msg.parent = data.chat.find(function (e) {
                                return e.id == msg.parent_id;
                            });
                        });
                        console.log(data);
                        return data;
                    }
                }
            });
        });
    };

    self.openDF2Details = function (group, did, uid) {
        console.log(group, did, uid);
        var postdata = {
            stageid: self.iterationIndicator,
            tmid: group,
            did: did
        };
        $http.post("get-team-chat-stage-df", postdata).success(function (res) {
            $uibModal.open({
                templateUrl: "templ/differential-group-2.html",
                controller: "EthicsModalController",
                controllerAs: "vm",
                scope: self,
                resolve: {
                    data: function data() {
                        var data = {};
                        data.names = [self.flang("answer")];
                        data.group = group;
                        data.users = self.users;

                        data.df = self.dfsStage.find(e => e.id == did);

                        data.anonNames = {};
                        data.sesid = self.selectedSes.id;

                        data.chat = res;
                        let i = 0;
                        let abc = "ABCDE";
                        data.chat.forEach(function (msg) {
                            if (msg.parent_id) msg.parent = data.chat.find(function (e) {
                                return e.id == msg.parent_id;
                            });
                            if(!data.anonNames[msg.uid]){
                                data.anonNames[msg.uid] = abc[i];
                                i += 1;
                            }
                        });

                        data.stage = self.shared.stagesMap[self.iterationIndicator];

                        if(data.stage.type == "team"){
                            data.arr = self.shared.difTable.filter(e => e.tmid == group && !e.group);
                        }
                        else {
                            data.arr = self.shared.difTable.filter(e => e.uid == uid && !e.group);
                        }

                        data.arr.forEach(e => {
                            let el = e.arr.find(e => e && e.did == did);
                            e.sel = el ? el.sel : null;
                            e.comment = el ? el.comment : null;
                            if(!data.anonNames[e.uid]){
                                data.anonNames[e.uid] = abc[i];
                                i += 1;
                            }
                        });

                        data.dfarr = self.shared.buildArray(data.df.num);

                        console.log(data);
                        return data;
                    }
                }
            });
        });
    };

    self.openActorDetails = function  (uid, stageid) {
        let group = self.shared.groupByUid ? self.shared.groupByUid[uid] ? self.shared.groupByUid[uid].tmid : null : null;
        var postdata = {
            stageid: stageid,
            tmid: group
        };
        $http.post("get-team-chat-stage", postdata).success(function (res) {
            $uibModal.open({
                templateUrl: "templ/actor-dialog.html",
                controller: "EthicsModalController",
                controllerAs: "vm",
                scope: self,
                resolve: {
                    data: function data() {
                        var data = {};
                        data.group = group;
                        data.users = self.users;
                        data.actorMap = self.actorMap;

                        data.anonNames = {};
                        data.sesid = self.selectedSes.id;

                        data.chat = res;
                        let i = 0;
                        let abc = "ABCDE";
                        data.chat.forEach(function (msg) {
                            if (msg.parent_id) msg.parent = data.chat.find(function (e) {
                                return e.id == msg.parent_id;
                            });
                            if(!data.anonNames[msg.uid]){
                                data.anonNames[msg.uid] = abc[i];
                                i += 1;
                            }
                        });

                        data.stage = self.shared.stagesMap[stageid];

                        if(data.stage.type == "team"){
                            data.sel = self.indvTableSorted.filter(e => self.shared.groupByUid[e.uid].index == self.shared.groupByUid[uid].index);
                        }
                        else {
                            data.sel = self.indvTableSorted.filter(e => e.uid == uid);
                        }

                        data.sel.forEach(e => {
                            if(!data.anonNames[e.uid]){
                                data.anonNames[e.uid] = abc[i];
                                i += 1;
                            }
                        });

                        console.log(data);
                        return data;
                    }
                }
            });
        });
    };



    self.exportCSV = function(){
        var postdata = {
            sesid: self.selectedSes.id
        };
        $http.post("get-sel-data-csv", postdata).success(function (res) {
            if(res != null && res.length > 0) {
                saveCsv(res, {
                    filename: "seleccion_" + self.selectedSes.id + ".csv",
                    formatter: function(v){
                        if(v == null){
                            return "";
                        }
                        if(typeof(v) == "string"){
                            v = v.replace(/"/g, "'").replace(/\n/g, "");
                            return '"' + v + '"';
                        }
                        return "" + v;
                    }
                });
            }
            else {
                Notification.error("No hay datos de selección para exportar");
            }
        });
        $http.post("get-chat-data-csv", postdata).success(function (res) {
            if(res != null && res.length > 0) {
                saveCsv(res, {
                    filename: "chat_" + self.selectedSes.id + ".csv",
                    formatter: function(v){
                        if(v == null){
                            return "";
                        }
                        if(typeof(v) == "string"){
                            v = v.replace(/"/g, "'").replace(/\n/g, "");
                            return '"' + v + '"';
                        }
                        return "" + v;
                    }
                });
            }
            else {
                Notification.error("No hay datos de chat para exportar");
            }
        });
    };

    self.exportChatCSV = function(){
        var postdata = {
            sesid: self.selectedSes.id
        };
        let url = self.selectedSes.type == "T" ? "get-chat-data-csv-ethics" :
            self.selectedSes.type == "R" ? "get-chat-data-csv-role" : null;
        if(url == null){
            Notification.error("No se puede exportar los datos");
            return;
        }
        $http.post(url, postdata).success(function (res) {
            if(res != null && res.length > 0) {
                saveCsv(res, {
                    filename: "chat_" + self.selectedSes.id + ".csv",
                    formatter: function(v){
                        if(v == null){
                            return "";
                        }
                        if(typeof(v) == "string"){
                            v = v.replace(/"/g, "'").replace(/\n/g, "");
                            return '"' + v + '"';
                        }
                        return "" + v;
                    }
                });
            }
            else {
                Notification.error("No hay datos para exportar");
            }
        });
    };

    self.exportSelCSV = function(){
        var postdata = {
            sesid: self.selectedSes.id
        };
        let url = self.selectedSes.type == "T" ? "get-sel-data-csv-ethics" :
            self.selectedSes.type == "R" ? "get-sel-data-csv-role" :
            self.selectedSes.type == "J" ? "get-sel-data-csv-jigsaw" : null;
        console.log(self.selectedSes);
        if(url == null){
            Notification.error("No se puede exportar los datos");
            return;
        }
        $http.post(url, postdata).success(function (res) {
            if(res != null && res.length > 0) {
                saveCsv(res, {
                    filename: "sel_" + self.selectedSes.id + ".csv",
                    formatter: function(v){
                        if(v == null){
                            return "";
                        }
                        if(typeof(v) == "string"){
                            v = v.replace(/"/g, "'").replace(/\n/g, "");
                            return '"' + v + '"';
                        }
                        return "" + v;
                    }
                });
            }
            else {
                Notification.error("No hay datos para exportar");
            }
        });
    };

    self.sortByAutorName = (a, b) => {
        let ua = self.users[a] ? self.users[a].name : a;
        let ub = self.users[b] ? self.users[b].name : b;
        return ua < ub ? -1 : 1;
    };

    self.sortByAutorGroup = (a, b) => {
        return self.shared.groupByUid[a].index - self.shared.groupByUid[b].index;
    };

});

adpp.controller("MapSelectionModalController", function ($scope, $uibModalInstance) {
    var vm = this;

    vm.nav = true;
    vm.edit = false;

    vm.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };

    vm.resolve = function () {
        $uibModalInstance.close({
            nav: vm.nav,
            edit: vm.edit
        });
    };
});

adpp.controller("ReportModalController", function ($scope, $uibModalInstance, data) {
    var vm = this;
    vm.data = data;

    vm.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };
});

adpp.controller("ContentModalController", function ($scope, $uibModalInstance, data) {
    var vm = this;
    vm.data = data;

    vm.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };
});

adpp.controller("EthicsModalController", function ($scope, $http, $uibModalInstance, Notification, data) {
    var vm = this;
    vm.data = data;
    vm.isAnon = true;

    vm.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };

    vm.shareDetails = function () {
        if (!vm.isAnon) {
            Notification.error("Sólo se pueden enviar diferenciales en forma anónima");
            return;
        }
        var content = document.getElementById("details-modal").innerHTML.replace(/<\!--.*?-->/g, "");
        var postdata = {
            sesid: vm.data.sesid,
            content: content
        };
        $http({ url: "broadcast-diff", method: "post", data: postdata }).success(function (data) {
            Notification.success("Diferencial enviado exitosamente");
        });
    };
});

adpp.controller("DuplicateSesModalController", function ($scope, $http, $uibModalInstance, data) {
    var vm = this;
    vm.data = data;
    vm.nses = {
        name: vm.data.name,
        tipo: vm.data.type,
        descr: vm.data.descr,
        originalSesid: vm.data.id,
        copyDocuments: false,
        copyIdeas: false,
        copyQuestions: false,
        copyRubrica: false,
        copyUsers: false,
        copySemUnits: false,
        copySemDocs: false,
        copyDifferentials: false
    };

    vm.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };

    vm.sendDuplicate = function () {
        console.log(vm.nses);
        $http({ url: "duplicate-session", method: "post", data: vm.nses }).success(function (data) {
            console.log(data);
            window.location.replace("admin");
        });
    };
});

adpp.controller("GroupController", function ($scope, $http, Notification) {
    var self = $scope;
    self.methods = [];
    self.lastI = -1;
    self.lastJ = -1;
    self.groupMet = "random";

    self.shared.verifyGroups = function () {
        self.methods = [klg("random"), klg("performance", "homog"), klg("performance", "heterg"), klg("knowledgeType", "homog"), klg("knowledgeType", "heterg")];
        self.groupNum = 3;
        self.groupMet = self.methods[0].key;
        self.groups = [];
        self.groupNames = [];
        if (self.selectedSes != null && self.selectedSes.grouped) {
            self.groupNum = null;
            self.groupMet = null;
            self.generateGroups(true);
        }
    };

    var klg = function klg(k1, k2) {
        return {
            key: k1 + (k2 == null ? "" : " " + k2),
            name: self.flang(k1) + (k2 == null ? "" : " " + self.flang(k2))
        };
    };

    self.generateGroups = function (key) {
        if (self.selectedSes.grouped) {
            $http({ url: "group-proposal-sel", method: "post", data: { sesid: self.selectedSes.id } }).success(function (data) {
                self.groups = data;
                self.shared.groups = self.groups;
                //self.groupsProp = angular.copy(self.groups);
                console.log("G", data);
                //self.groupNames = [];
            });
            return;
        }
        if (key == null && (self.groupNum < 1 || self.groupNum > self.users.length)) {
            Notification.error("Error en los parámetros de formación de grupos");
            return;
        }

        var postdata = {
            sesid: self.selectedSes.id,
            gnum: self.groupNum,
            method: self.groupMet
        };

        console.log(postdata);

        console.log(self.shared.alumState);
        var users = Object.values(self.users).filter(function (e) {
            return e.role == "A";
        });
        console.log(users);

        if (self.groupMet == "knowledgeType homog" || self.groupMet == "knowledgeType heterg") {
            self.groups = generateTeams(users, habMetric, self.groupNum, isDifferent(self.groupMet));
        } else if (self.groupMet == "random") {
            var arr = users.map(function (e) {
                e.rnd = Math.random();
                return e;
            });
            self.groups = generateTeams(arr, function (s) {
                return s.rnd;
            }, self.groupNum, false);
        } else if (self.selectedSes.type == "S" || self.selectedSes.type == "M") {
            console.log(self.shared.alumState);
            var _arr = [];
            for (var uid in self.shared.alumState) {
                var s = 0;
                for (var q in self.shared.alumState[uid]) {
                    s += +q;
                }
                _arr.push({ uid: uid, score: s });
            }
            self.groups = generateTeams(_arr, function (s) {
                return s.score;
            }, self.groupNum, isDifferent(self.groupMet));
        } else if (self.selectedSes.type == "L") {
            self.groups = generateTeams(self.shared.alumState, function (s) {
                return s.score;
            }, self.groupNum, isDifferent(self.groupMet));
        }
        else if (self.selectedSes.type == "E"){
            console.log("AAAAA");
            let dfd = users.map(e => {
                let d = (self.shared.dataDF || []);
                let r = d.find(f => f.tmid == e.id);
                console.log(r);
                return {
                    uid: e.id,
                    score: (r && r.ind && r.ind.length > 0) ? (r.ind.reduce((v,p) => v + p.sel, 0) / r.ind.length) : 0
                }
            });
            console.log(dfd);
            self.groups = generateTeams(dfd, function (s) {
                return s.score;
            }, self.groupNum, isDifferent(self.groupMet));
        }

        if (self.groups != null) {
            self.groupsProp = angular.copy(self.groups);
            self.groupNames = [];
        }

        /*if (urlRequest != "") {
            $http({url: urlRequest, method: "post", data: postdata}).success((data) => {
                self.groups = data;
                self.groupsProp = angular.copy(self.groups);
                console.log(data);
                self.groupNames = [];
                /*data.forEach((d) => {
                 self.groupNames.push(d.map(i => self.users[i.uid].name).join(", "));
                 });*
            });
        }*/
    };

    self.acceptGroups = function () {
        if (self.groupsProp == null) {
            Notification.error("No hay propuesta de grupos para fijar");
            return;
        }
        var postdata = {
            sesid: self.selectedSes.id,
            groups: JSON.stringify(self.groups.map(function (e) {
                return e.map(function (f) {
                    return f.uid || f.id;
                });
            }))
        };
        console.log(postdata);
        $http({ url: "set-groups", method: "post", data: postdata }).success(function (data) {
            if (data.status == "ok") {
                console.log("Groups accepted");
                self.selectedSes.grouped = true;
                self.shared.verifyGroups();
            }
        });
    };

    self.swapTable = function (i, j) {
        console.log(i, j, self.groups);
        if (self.lastI == -1 && self.lastJ == -1) {
            self.lastI = i;
            self.lastJ = j;
            return;
        }
        if (!(self.lastI == i && self.lastJ == j)) {
            var temp = angular.copy(self.groupsProp[i][j]);
            self.groupsProp[i][j] = angular.copy(self.groupsProp[self.lastI][self.lastJ]);
            self.groupsProp[self.lastI][self.lastJ] = temp;
        }
        self.lastI = -1;
        self.lastJ = -1;
    };
});

adpp.controller("RubricaController", function ($scope, $http) {
    var self = $scope;
    self.criterios = [];
    self.newCriterio = {};
    self.editable = false;
    self.exampleReports = [];
    self.newExampleReport = "";
    self.pairNum = 3;
    self.rid = -1;

    self.addCriterio = function () {
        self.criterios.push({});
    };

    self.removeCriterio = function (idx) {
        self.criterios.splice(idx, 1);
    };

    self.checkSum = function () {
        return self.criterios.reduce(function (e, p) {
            return e + p.pond;
        }, 0) == 100;
    };

    self.shared.getRubrica = function () {
        self.criterios = [];
        self.newCriterio = {};
        self.editable = false;
        var postdata = { sesid: self.selectedSes.id };
        $http({ url: "get-admin-rubrica", method: "post", data: postdata }).success(function (data) {
            if (data.length == 0) {
                self.editable = true;
            } else {
                self.criterios = data;
                self.rid = data[0].rid;
            }
        });
    };

    self.startEditing = function () {
        self.editable = true;
    };

    self.saveRubrica = function () {
        if (self.rid != -1) {
            self.saveEditRubrica();
            return;
        }
        var postdata = { sesid: self.selectedSes.id };
        $http({ url: "send-rubrica", method: "post", data: postdata }).success(function (data) {
            if (data.status == "ok") {
                var rid = data.id;
                self.criterios.forEach(function (criterio) {
                    var postdata = angular.copy(criterio);
                    postdata.rid = rid;
                    $http({ url: "send-criteria", method: "post", data: postdata }).success(function (data) {
                        if (data.status == "ok") console.log("Ok");
                    });
                });
                self.editable = false;
            }
        });
    };

    self.saveEditRubrica = function () {
        if (self.rid == -1) return;
        var postdata = { rid: self.rid };
        $http({ url: "delete-criterias", method: "post", data: postdata }).success(function (data) {
            if (data.status == "ok") {
                var rid = self.rid;
                self.criterios.forEach(function (criterio) {
                    var postdata = angular.copy(criterio);
                    postdata.rid = rid;
                    $http({ url: "send-criteria", method: "post", data: postdata }).success(function (data) {
                        if (data.status == "ok") console.log("Ok");
                    });
                });
                self.editable = false;
            }
        });
    };

    self.shared.getExampleReports = function () {
        self.exampleReports = [];
        var postdata = { sesid: self.selectedSes.id };
        $http({ url: "get-example-reports", method: "post", data: postdata }).success(function (data) {
            self.exampleReports = data;
        });
    };

    self.sendExampleReport = function () {
        var postdata = {
            sesid: self.selectedSes.id,
            content: self.newExampleReport.text,
            title: self.newExampleReport.title
        };
        $http({ url: "send-example-report", method: "post", data: postdata }).success(function (data) {
            self.newExampleReport = "";
            self.shared.getExampleReports();
        });
    };

    self.setActiveExampleReport = function (rep) {
        var postdata = { sesid: self.selectedSes.id, rid: rep.id };
        $http({ url: "set-active-example-report", method: "post", data: postdata }).success(function (data) {
            if (data.status == 'ok') {
                self.exampleReports.forEach(function (r) {
                    r.active = false;
                });
                rep.active = true;
            }
        });
    };

    self.goToReport = function (rep) {
        self.setActiveExampleReport(rep);
        window.location.href = "to-rubrica?sesid=" + self.selectedSes.id;
    };

    self.pairAssign = function () {
        var postdata = { sesid: self.selectedSes.id, rnum: +self.pairNum || 3 };
        $http({ url: "assign-pairs", method: "post", data: postdata }).success(function (data) {
            if (data.status == "ok") {
                // self.shared.updateSesData();
                self.selectedSes.paired = self.pairNum;
                self.errPairMsg = "";
            } else {
                self.errPairMsg = data.msg;
            }
        });
    };

    self.shared.obtainCriterios = function () {
        return self.criterios;
    };

    self.shared.isRubricaSet = function () {
        return !self.editable;
    };
});

adpp.controller("OptionsController", function ($scope, $http, Notification) {
    var self = $scope;
    self.conf = {};
    self.sesidConfig = -1;
    self.options = [{ name: "optCom", code: "J" }, { name: "optConfLv", code: "C" }, { name: "optHint", code: "H" }];

    self.saveConfs = function () {
        var postdata = {
            sesid: self.selectedSes.id,
            options: self.buildConfStr()
        };
        $http.post("update-ses-options", postdata).success(function (data) {
            if (data.status == "ok") {
                Notification.success("Opciones actualizadas");
                self.selectedSes.options = postdata.options;
                self.selectedSes.conf = null;
                self.shared.updateConf();
            }
        });
    };

    self.shared.saveConfs = self.saveConfs;

    self.shared.updateConf = function () {
        if (self.selectedSes.conf == null) {
            self.selectedSes.conf = {};
            var op = self.selectedSes.options || "";
            for (var i = 0; i < op.length; i++) {
                self.selectedSes.conf[op[i]] = true;
            }
            console.log(self.selectedSes);
        }
        return true;
    };

    self.buildConfStr = function () {
        var s = "";
        for (var key in self.selectedSes.conf) {
            if (self.selectedSes.conf[key]) s += key;
        }
        return s;
    };
});

adpp.controller("DashboardRubricaController", function ($scope, $http) {
    var self = $scope;
    self.reports = [];
    self.result = [];
    self.selectedReport = null;

    self.shared.resetRubricaGraphs = function () {
        self.alumState = null;
        self.barOpts = {
            chart: {
                type: 'multiBarChart',
                height: 320,
                x: function x(d) {
                    return d.label;
                },
                y: function y(d) {
                    return d.value;
                },
                showControls: false,
                showValues: false,
                duration: 500,
                xAxis: {
                    showMaxMin: false
                },
                yAxis: {
                    axisLabel: 'Cantidad Alumnos'
                }
            }
        };
        self.barData = [{ key: "Alumnos", color: "#ef6c00", values: [] }];
        //self.updateGraph();
    };

    self.shared.resetRubricaGraphs();
});

adpp.controller("GeoAdminController", ["$scope", "$http", "NgMap", function ($scope, $http, NgMap) {

    var self = $scope;

    self.openRight = false;
    self.rightTab = "";

    self.mOverlays = [];
    self.sOverlays = [];

    self.selectedOverlay = null;

    self.overlayBuffer = [];

    var init = function init() {
        self.updateOverlayList();
        self.clearOverlay();
        NgMap.getMap().then(function (map) {
            console.log("MAP cargado correctamente");
            self.map = map;
            self.map.streetView.setOptions({ addressControlOptions: { position: google.maps.ControlPosition.TOP_CENTER } });
            self.map.infoWindows.iw.close();
        });
        self.misc.mapHasVisData = false;
    };

    var toOverlay = function toOverlay(data) {
        return {
            id: data.id,
            name: data.name,
            description: data.description,
            color: getColor(data),
            type: data.type,
            fullType: getFullType(data.type),
            geom: JSON.parse(data.geom)
        };
    };

    var getColor = function getColor(data) {
        return "blue";
    };

    var packOverlay = function packOverlay(overlay) {
        return {
            name: overlay.name,
            description: overlay.description,
            iteration: 0,
            qid: self.questions[self.selectedQs] != null ? self.questions[self.selectedQs].id : -1,
            type: overlay.type,
            geom: JSON.stringify(overlay.geom)
        };
    };

    var getFullType = function getFullType(t) {
        switch (t) {
            case "M":
                return "marker";
            case "P":
                return "polygon";
            case "L":
                return "polyline";
            case "R":
                return "rectangle";
            case "C":
                return "circle";
            case "I":
                return "image";
        }
    };

    self.shared.processPrevMapData = function (data, qid) {
        self.shared.closePrevMapData();
        self.shared.processMapData(data, qid);
        self.misc.mapHasVisData = true;
        console.log(self.misc);
    };

    self.shared.processMapData = function (data, qid) {
        self.shared.closePrevMapData();
        var comps = data.split(" ");
        console.log(comps);
        self.map.setCenter(new google.maps.LatLng(+comps[1], +comps[2]));
        self.map.setZoom(+comps[3]);
        self.misc.mapNav = comps[4] == "NAV";
        self.misc.mapEdit = comps[4] == "EDIT" || comps[5] == "EDIT";
        getPrevOverlays(qid);
        google.maps.event.trigger(self.map, "resize");
        self.misc.mapHasVisData = false;
    };

    self.shared.closePrevMapData = function () {
        self.shared.clearOverlayBuffer();
        self.misc.mapHasVisData = false;
    };

    var getPrevOverlays = function getPrevOverlays(qid) {
        $http.post("list-default-overlay", { qid: qid }).success(function (data) {
            var overlays = data.map(toOverlay);
            self.mOverlays = self.mOverlays.concat(overlays.filter(function (e) {
                return e.type == "M";
            }));
            self.sOverlays = self.sOverlays.concat(overlays.filter(function (e) {
                return e.type != "M";
            }));
        });
    };

    self.clearOverlay = function () {
        self.newOverlay = {
            name: "",
            description: "",
            color: "blue",
            type: "M",
            fullType: "marker",
            geom: {
                position: null,
                radius: null,
                center: null,
                path: null,
                bounds: null
            }
        };
    };

    self.updateOverlayList = function () {
        var postdata = {
            qid: self.questions[self.selectedQs] != null ? self.questions[self.selectedQs].id : -1
        };
        $http.post("list-overlay", postdata).success(function (data) {
            var overlays = data.map(toOverlay);
            self.mOverlays = overlays.filter(function (e) {
                return e.type == "M";
            });
            self.sOverlays = overlays.filter(function (e) {
                return e.type != "M";
            });
        });
    };

    self.shared.updateOverlayList = self.updateOverlayList;

    self.onMapOverlayCompleted = function (ev) {
        self.map.mapDrawingManager[0].setDrawingMode(null);

        self.newOverlay.fullType = ev.type;
        self.newOverlay.type = ev.type == "polyline" ? "L" : ev.type[0].toUpperCase();
        self.newOverlay.geom.position = ev.overlay.getPosition ? positionToArray(ev.overlay.getPosition()) : null;
        self.newOverlay.geom.radius = ev.overlay.radius;
        self.newOverlay.geom.center = positionToArray(ev.overlay.center);
        self.newOverlay.geom.path = ev.overlay.getPath ? mutiplePositionToArray(ev.overlay.getPath()) : null;
        self.newOverlay.geom.bounds = ev.overlay.getBounds ? boundsToArray(ev.overlay.getBounds()) : null;

        self.newOverlay.centroid = centroidAsLatLng(self.newOverlay.type, self.newOverlay.geom);
        self.map.showInfoWindow("iw2");

        ev.overlay.setMap(null);
    };

    self.colorizeShape = function (col) {
        if (self.map.shapes && self.map.shapes.nshp) {
            self.map.shapes.nshp.set("fillColor", col);
            self.map.shapes.nshp.set("strokeColor", "dark" + col);
        }
    };

    self.closeOverlay = function () {
        self.clearOverlay();
        self.map.infoWindows.iw2.close();
    };

    var updateOverlay = function updateOverlay() {
        var ov = self.newOverlay.type == "M" ? self.map.markers.nmkr : self.map.shapes.nshp;
        self.newOverlay.geom.position = ov.getPosition ? positionToArray(ov.getPosition()) : null;
        self.newOverlay.geom.radius = ov.radius;
        self.newOverlay.geom.center = positionToArray(ov.center);
        self.newOverlay.geom.path = ov.getPath ? mutiplePositionToArray(ov.getPath()) : null;
        self.newOverlay.geom.bounds = ov.getBounds ? boundsToArray(ov.getBounds()) : null;
        self.newOverlay.centroid = centroidAsLatLng(self.newOverlay.type, self.newOverlay.geom);
        //self.map.showInfoWindow("iw2");
    };

    self.sendOverlay = function () {
        updateOverlay();
        self.overlayBuffer.push(packOverlay(self.newOverlay));
        console.log(self.overlayBuffer);
        if (self.newOverlay.type == "M") {
            self.mOverlays.push(self.newOverlay);
        } else {
            self.sOverlays.push(self.newOverlay);
        }
        self.closeOverlay();
    };

    self.shared.clearOverlayBuffer = function () {
        self.mOverlays = [];
        self.sOverlays = [];
        self.overlayBuffer = [];
    };

    self.shared.sendOverlayBuffer = function (id) {
        console.log(id, self.overlayBuffer);
        self.overlayBuffer.forEach(function (ov) {
            ov.qid = id;
            $http.post("add-overlay", ov).success(function (data) {
                console.log("OK");
            });
        });
        self.shared.closePrevMapData();
    };

    self.clickOverlay = function (event) {
        self.selectOverlay(this.id);
    };

    self.selectOverlay = function (id) {
        self.selectedOverlay = self.mOverlays.find(function (e) {
            return e.id == id;
        }) || self.sOverlays.find(function (e) {
            return e.id == id;
        });
        self.selectedOverlay.centroid = centroidAsLatLng(self.selectedOverlay.type, self.selectedOverlay.geom);
        self.map.panTo(self.selectedOverlay.centroid);
        self.map.showInfoWindow("iw");
    };

    self.googleSearch = function () {
        var p = this.getPlace();
        if (p == null || p.geometry == null || p.geometry.location == null) return;

        self.map.mapDrawingManager[0].setDrawingMode(null);
        self.newOverlay.fullType = "marker";
        self.newOverlay.type = "M";
        self.newOverlay.geom.position = positionToArray(p.geometry.location);
        self.newOverlay.centroid = centroidAsLatLng(self.newOverlay.type, self.newOverlay.geom);

        self.map.showInfoWindow("iw2");
        self.map.panTo(p.geometry.location);
    };

    self.shared.getPluginMapOptions = function () {
        return {
            nav: self.misc.mapNav,
            edit: self.misc.mapEdit
        };
    };

    self.shared.getActiveMap = function () {
        return self.map;
    };

    init();
}]);

adpp.controller("StagesController", ["$scope", "$http", "Notification", "$uibModal", window.StagesController]);

adpp.filter('htmlExtractText', function () {
    return function (text) {
        return text ? String(text).replace(/<[^>]+>/gm, '') : '';
    };
});

adpp.filter("trustHtml", ["$sce", function ($sce) {
    return function (html) {
        return $sce.trustAsHtml(html);
    };
}]);

adpp.filter('lang', function () {
    filt.$stateful = true;
    return filt;

    function filt(label) {
        if (window.DIC == null) return;
        if (window.DIC[label]) return window.DIC[label];
        if (!window.warnDIC[label]) {
            console.warn("Cannot find translation for ", label);
            window.warnDIC[label] = true;
        }
        return label;
    }
});

var generateTeams = function generateTeams(alumArr, scFun, n, different, double) {
    if (n == null || n == 0) return [];
    console.log(alumArr);
    var arr = alumArr;
    if(!double) {
        arr.sort(function (a, b) {
            return scFun(b) - scFun(a);
        });
    }
    else{
        arr.sort(scFun);
    }
    var groups = [];
    var numGroups = alumArr.length / n;
    for (var i = 0; i < numGroups; i++) {
        if (different) {
            (function () {
                var rnd = [];
                var offset = arr.length / n;
                for (var j = 0; j < n; j++) {
                    rnd.push(~~(Math.random() * offset + offset * j));
                }
                groups.push(arr.filter(function (a, i) {
                    return rnd.includes(i);
                }));
                arr = arr.filter(function (a, i) {
                    return !rnd.includes(i);
                });
            })();
        } else {
            groups.push(arr.filter(function (a, i) {
                return i < n;
            }));
            arr = arr.filter(function (a, i) {
                return i >= n;
            });
        }
    }
    var final_groups = [];
    var ov = 0;
    for (var _i = 0; _i < groups.length; _i++) {
        if (groups[_i].length > 1 || final_groups.length == 0) {
            final_groups.push(groups[_i]);
        }
        else {
            final_groups[ov % final_groups.length].push(groups[_i][0]);
            ov++;
        }
    }
    return final_groups;
};

var isDifferent = function isDifferent(type) {
    switch (type) {
        case "performance homog":
            return false;
        case "performance heterg":
            return true;
        case "knowledgeType homog":
            return false;
        case "knowledgeType heterg":
            return true;
    }
    return false;
};

var habMetric = function habMetric(u) {
    switch (u.aprendizaje) {
        case "Teorico":
            return -2;
        case "Reflexivo":
            return -1;
        case "Activo":
            return 1;
        case "Pragmatico":
            return 2;
    }
    return 0;
};

var quillMapHandler = function quillMapHandler() {
    alert("Mapa sólo disponible para preguntas");
};

var positionToArray = function positionToArray(pos) {
    if (pos == null) return null;
    return [pos.lat(), pos.lng()];
};

var mutiplePositionToArray = function mutiplePositionToArray(mpos) {
    var r = [];
    for (var i = 0; i < mpos.getLength(); i++) {
        var pos = mpos.getAt(i);
        r.push(positionToArray(pos));
    }
    return r;
};

var boundsToArray = function boundsToArray(bounds) {
    return [positionToArray(bounds.getSouthWest()), positionToArray(bounds.getNorthEast())];
};

var avgCoord = function avgCoord(arr) {
    var slat = 0;
    var slng = 0;
    for (var i = 0; i < arr.length; i++) {
        slat += arr[i][0];
        slng += arr[i][1];
    }
    return [slat / arr.length, slng / arr.length];
};

var centroidAsLatLng = function centroidAsLatLng(type, geom) {
    var c = centroid(type, geom);
    return new google.maps.LatLng(c[0], c[1]);
};

var centroid = function centroid(type, geom) {
    if (type == "M") return geom.position;
    if (type == "C") return geom.center;
    if (type == "R") return avgCoord(geom.bounds);
    if (type == "P" || type == "L") return avgCoord(geom.path);
    return null;
};
