"use strict";

let adpp = angular.module("Admin", ["ui.bootstrap", "ui.multiselect", "nvd3", "timer", "ui-notification"]);

const DASHBOARD_AUTOREALOD = true;
const DASHBOARD_AUTOREALOD_TIME = 15;

adpp.controller("AdminController", function ($scope, $http, $uibModal, $location, $locale) {
    let self = $scope;
    $locale.NUMBER_FORMATS.GROUP_SEP = '';
    self.shared = {};
    self.sessions = [];
    self.selectedSes = null;
    self.documents = [];
    self.questions = [];
    self.newUsers = [];
    self.users = {};
    self.selectedIndex = -1;
    self.sesStatusses = ["No Publicada", "Lectura", "Personal", "Anónimo", "Grupal", "Finalizada"];
    self.iterationNames = [{name: "Lectura", val: 0}, {name: "Individual", val: 1}, {
        name: "Grupal anónimo",
        val: 2
    }, {name: "Grupal", val: 3}];

    self.init = () => {
        self.shared.updateSesData();
    };

    self.selectSession = (idx) => {
        self.selectedIndex = idx;
        self.selectedSes = self.sessions[idx];
        self.requestDocuments();
        self.requestQuestions();
        self.getNewUsers();
        self.getMembers();
        self.shared.verifyGroups();
        self.shared.resetGraphs();
        self.shared.verifyTabs();
        self.shared.resetTab();
        $location.path(self.selectedSes.id);
    };

    self.shared.updateSesData = () => {
        $http({url: "get-session-list", method: "post"}).success((data) => {
            console.log("Session data updated");
            self.sessions = data;
            if (self.selectedIndex != -1)
                self.selectSession(self.selectedIndex);
            else {
                self.sesFromURL();
            }
        });
    };

    self.sesFromURL = () => {
        let sesid = +($location.path().substring(1));
        let sidx = self.sessions.findIndex(e => e.id == sesid);
        if (sidx != -1)
            self.selectSession(sidx);
    };

    self.requestDocuments = () => {
        let postdata = {sesid: self.selectedSes.id};
        $http({url: "documents-session", method: "post", data: postdata}).success((data) => {
            self.documents = data;
        });
    };

    self.shared.updateDocuments = self.requestDocuments;

    self.deleteDocument = (docid) => {
        let postdata = {docid: docid};
        $http({url: "delete-document", method: "post", data: postdata}).success((data) => {
            self.requestDocuments();
        });
    };

    self.requestQuestions = () => {
        let postdata = {sesid: self.selectedSes.id};
        $http({url: "questions-session", method: "post", data: postdata}).success((data) => {
            self.questions = data.map(e => {
                e.options = e.options.split("\n");
                return e;
            });
        });
    };

    self.getNewUsers = () => {
        let postdata = {sesid: self.selectedSes.id};
        $http({url: "get-new-users", method: "post", data: postdata}).success((data) => {
            self.newUsers = data;
        });
    };

    self.getMembers = () => {
        let postdata = {sesid: self.selectedSes.id};
        $http({url: "get-ses-users", method: "post", data: postdata}).success((data) => {
            self.usersArr = data;
            data.forEach((d) => {
                self.users[d.id] = d;
            });
        });
    };

    self.openNewSes = () => {
        $uibModal.open({
            templateUrl: "templ/new-ses.html"
        });
    };

    self.init();
});


adpp.controller("TabsController", function ($scope, $http) {
    let self = $scope;
    self.tabOptions = ["Descripción", "Dashboard"];
    self.tabConfig = ["Usuarios", "Grupos"];
    self.selectedTab = 0;
    self.selectedTabConfig = -1;

    self.shared.resetTab = () => {
        self.selectedTab = 0;
        if (self.selectedSes != null && self.selectedSes.status > 1) {
            self.selectedTab = 1;
        }
        self.selectedTabConfig = -1;
        if (self.selectedSes.status == 7) {
            self.shared.gotoRubrica();
        }
    };

    self.shared.verifyTabs = () => {
        if (self.selectedSes.type == "L") {
            self.iterationNames = [{name: "Lectura", val: 0}, {name: "Individual", val: 1}, {
                name: "Grupal anónimo",
                val: 2
            }, {name: "Grupal", val: 3}, {name: "Reporte", val: 4}, {
                name: "Calibración Rubrica",
                val: 5
            }, {name: "Evaluación de Pares", val: 6}];
            self.tabOptions = ["Configuración", "Dashboard"];
            self.tabConfig = ["Usuarios", "Grupos", "Rúbrica"];
            self.sesStatusses = ["Configuración", "Lectura", "Individual", "Anónimo", "Grupal", "Reporte", "Rubrica Calibración", "Evaluación de Pares", "Finalizada"];
            self.shared.getRubrica();
            self.shared.getExampleReports();
            self.shared.getReports();
        }
        else {
            self.iterationNames = [{name: "Individual", val: 1}, {name: "Grupal anónimo", val: 2}, {
                name: "Grupal",
                val: 3
            }];
            self.tabOptions = ["Configuración", "Dashboard"];
            self.tabConfig = ["Usuarios", "Grupos"];
            self.sesStatusses = ["Configuración", "Individual", "Anónimo", "Grupal", "Finalizada"];
        }
        if (self.selectedSes.status > 1) {
            self.selectedTab = 1;
        }
    };

    self.setTab = (idx) => {
        self.selectedTab = idx;
    };

    self.setTabConfig = (idx) => {
        self.selectedTabConfig = idx;
    };

    self.shared.gotoGrupos = () => {
        self.selectedTab = 0;
        self.selectedTabConfig = 1;
    };

    self.shared.gotoRubrica = () => {
        self.selectedTab = 0;
        self.selectedTabConfig = 2;
    };

});

adpp.controller("DocumentsController", function ($scope, $http, Notification) {
    let self = $scope;

    self.busy = false;

    self.uploadDocument = (event) => {
        self.busy = true;
        let fd = new FormData(event.target);
        $http.post("upload-file", fd, {
            transformRequest: angular.identity,
            headers: {'Content-Type': undefined}
        }).success((data) => {
            if(data.status == "ok"){
                Notification.success("Documento cargado correctamente");
                event.target.reset();
                self.busy = false;
                self.shared.updateDocuments();
            }
        });
    };

});

adpp.controller("SesEditorController", function ($scope, $http, Notification) {
    let self = $scope;

    self.updateSession = () => {
        if (self.selectedSes.name.length < 3 || self.selectedSes.descr.length < 5){
            Notification.error("Datos de la sesión incorrectos o incompletos");
            return;
        }
        let postdata = {name: self.selectedSes.name, descr: self.selectedSes.descr, id: self.selectedSes.id};
        $http({url: "update-session", method: "post", data: postdata}).success((data) => {
            console.log("Session updated");
        });
    };

    self.shared.changeState = () => {
        if (self.selectedSes.status >= self.sesStatusses.length){
            Notification.error("La sesión está finalizada");
            return;
        }
        if (self.selectedSes.type == "L" && self.selectedSes.status >= 3 && !self.selectedSes.grouped
            || self.selectedSes.type == "S" && self.selectedSes.status >= 2 && !self.selectedSes.grouped) {
            self.shared.gotoGrupos();
            Notification.error("Los grupos no han sido generados");
            return;
        }
        if (self.selectedSes.status >= 7 && !self.selectedSes.paired) {
            self.shared.gotoRubrica();
            Notification.error("Los pares para la evaluación de pares no han sido asignados");
            return;
        }
        let postdata = {sesid: self.selectedSes.id};
        $http({url: "change-state-session", method: "post", data: postdata}).success((data) => {
            self.shared.updateSesData();
        });
    }

});


adpp.controller("NewUsersController", function ($scope, $http, Notification) {
    let self = $scope;
    let newMembs = [];

    self.addToSession = () => {
        if (self.newMembs.length == 0){
            Notification.error("No hay usuarios seleccionados para agregar");
            return;
        }
        let postdata = {
            users: self.newMembs.map(e => e.id),
            sesid: self.selectedSes.id
        };
        $http({url: "add-ses-users", method: "post", data: postdata}).success((data) => {
            if (data.status == "ok") {
                self.getNewUsers();
                self.getMembers();
            }
        });
    };

});

adpp.controller("QuestionsController", function ($scope, $http, Notification) {
    let self = $scope;

    self.qsLabels = ['A','B','C','D','E'];

    self.newQuestion = {
        content: "",
        alternatives: ["", "", "", "", ""],
        comment: "",
        other: "",
        answer: -1
    };

    self.selectAnswer = (i) => {
        self.newQuestion.answer = i;
    };

    self.addQuestion = () => {
        if (self.newQuestion.answer == -1){
            Notification.error("Debe indicar la respuesta correcta a la pregunta");
            return;
        }
        let postdata = {
            content: self.newQuestion.content,
            options: self.newQuestion.alternatives.join("\n"),
            comment: self.newQuestion.comment,
            answer: self.newQuestion.answer,
            sesid: self.selectedSes.id,
            other: self.newQuestion.other
        };
        $http({url: "add-question", method: "post", data: postdata}).success((data) => {
            if (data.status == "ok")
                self.requestQuestions()
        });
        self.newQuestion = {
            content: "",
            alternatives: ["", "", "", "", ""],
            comment: "",
            other: "",
            answer: -1
        };
    }

});

adpp.controller("DashboardController", function ($scope, $http, $timeout, $uibModal) {
    let self = $scope;
    self.iterationIndicator = 1;
    self.currentTimer = null;

    self.shared.resetGraphs = () => {
        if (self.selectedSes != null && self.selectedSes.type == "L") {
            self.iterationIndicator = Math.max(Math.min(6, self.selectedSes.status - 2), 0);
        }
        else if (self.selectedSes.type == "S") {
            self.iterationIndicator = Math.max(Math.min(3, self.selectedSes.status - 1), 1);
        }
        self.alumState = null;
        self.barOpts = {
            chart: {
                type: 'multiBarChart',
                height: 320,
                x: d => d.label,
                y: d => d.value,
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
        self.barData = [{key: "Alumnos", color: "#ef6c00", values: []}];
        self.updateState();
        if(DASHBOARD_AUTOREALOD) {
            self.reload(true);
        }
    };

    self.reload = (k) => {
        if(!k){
            self.updateState();
        }
        if (self.currentTimer != null) {
            $timeout.cancel(self.currentTimer);
        }
        self.currentTimer = $timeout(self.reload, DASHBOARD_AUTOREALOD_TIME * 1000);
    };

    self.updateState = () => {
        if (self.iterationIndicator <= 4)
            self.updateStateIni();
        else
            self.updateStateRub();
    };

    self.updateStateIni = () => {
        self.alumTime = {};
        let postdata = {sesid: self.selectedSes.id, iteration: self.iterationIndicator};
        if (self.selectedSes.type == "S") {
            $http({url: "get-alum-full-state-sel", method: "post", data: postdata}).success((data) => {
                self.alumState = {};
                data.forEach((d) => {
                    if (self.alumState[d.uid] == null) {
                        self.alumState[d.uid] = {};
                        self.alumState[d.uid][d.qid] = d.correct;
                    }
                    else {
                        self.alumState[d.uid][d.qid] = d.correct;
                    }
                });
            });
            $http({url: "get-alum-state-sel", method: "post", data: postdata}).success((data) => {
                let dataNorm = data.map(d => {
                    d.score /= self.questions.length;
                    return d;
                });
                self.buildBarData(dataNorm);
            });
        }
        else if (self.selectedSes.type == "L") {
            $http({url: "get-alum-state-lect", method: "post", data: postdata}).success((data) => {
                self.alumState = data;
                self.buildBarData(data);
                self.getAlumDoneTime(postdata);
            });
            $http({url: "get-ideas-progress", method: "post", data: postdata}).success((data) => {
                self.numProgress = 0;
                self.numUsers = Object.keys(self.users).length - 1;
                let n = self.documents.length * 3;
                if (n != 0) {
                    data.forEach((d) => {
                        self.numProgress += d.count / n;
                    });
                    self.numProgress *= 100 / self.numUsers;
                }
            });
        }
    };

    self.getAlumDoneTime = (postdata) => {
        $http({url: "get-alum-done-time", method: "post", data: postdata}).success((data) => {
            self.numComplete = 0;
            data.forEach((row) => {
                self.numComplete += 1;
                let ai = self.alumState.findIndex(e => e.uid == row.uid);
                if (ai == -1)
                    self.alumState.push(row);
                else
                    self.alumState[ai].dtime = ~~(row.dtime);
            });
        });
    };

    self.buildBarData = (data) => {
        const N = 5;
        self.barData[0].values = [];
        for (let i = 0; i < N; i++) {
            let lbl = (i * 20) + "% - " + ((i + 1) * 20) + "%";
            self.barData[0].values.push({label: lbl, value: 0});
        }
        data.forEach((d) => {
            let rank = Math.min(Math.floor(N * d.score), N - 1);
            self.barData[0].values[rank].value += 1;
        });
        self.barOpts.chart.xAxis.axisLabel = "Rendimiento";
    };

    self.updateStateRub = () => {
        if (self.iterationIndicator == 5)
            self.computeDif();
        else if (self.iterationIndicator == 6)
            self.getAllReportResult();
    };

    self.showName = (report) => {
        if (report.example)
            return report.title + " - Texto ejemplo";
        else
            return report.id + " - Reporte de Alumno " + self.users[report.uid].name;
    };

    self.shared.getReports = () => {
        let postdata = {sesid: self.selectedSes.id};
        $http({url: "get-report-list", method: "post", data: postdata}).success((data) => {
            self.reports = data;
            self.exampleReports = data.filter(e => e.example);
        });
    };

    self.getReportResult = () => {
        let postdata = {repid: self.selectedReport.id};
        $http({url: "get-report-result", method: "post", data: postdata}).success((data) => {
            self.result = data;
            self.updateState();
        });
    };

    self.getAllReportResult = () => {
        let postdata = {sesid: self.selectedSes.id};
        $http({url: "get-report-result-all", method: "post", data: postdata}).success((data) => {
            self.resultAll = data;
            self.pairArr = (data[0]) ? new Array(data[0].length) : [];
            console.log(data);
            self.buildRubricaBarData(data);
        });
    };

    self.buildRubricaBarData = (data) => {
        const N = 3;
        self.barData[0].values = [];
        for (let i = 0; i < N; i++) {
            let lbl = (i + 1) + " - " + (i + 2);
            self.barData[0].values.push({label: lbl, value: 0});
        }
        data.forEach((d) => {
            let score = d.reduce((e, v) => e + v.val, 0) / d.length;
            let rank = Math.min(Math.floor(score - 1), N - 1);
            self.barData[0].values[rank].value += 1;
        });
        self.barOpts.chart.xAxis.axisLabel = "Puntaje";
    };

    self.computeDif = () => {
        if (self.result) {
            let pi = self.result.findIndex(e => self.users[e.uid].role == 'P');
            if (pi != -1) {
                let pval = self.result[pi].val;
                let difs = [];
                self.result.forEach((e, i) => {
                    if (i != pi) {
                        difs.push(Math.abs(pval - e.val));
                    }
                });
                self.buildRubricaDiffData(difs);
            }
        }
    };

    self.buildRubricaDiffData = (difs) => {
        console.log("difs", difs);
        const N = 6;
        self.barData[0].values = [];
        for (let i = 0; i < N; i++) {
            let lbl = (i * 0.5) + " - " + (i + 1) * 0.5;
            self.barData[0].values.push({label: lbl, value: 0});
        }
        difs.forEach((d) => {
            let rank = Math.min(Math.floor(d * 2), N - 1);
            self.barData[0].values[rank].value += 1;
        });
        self.barOpts.chart.xAxis.axisLabel = "Diferencia de Puntaje";
    };

    self.getReportAuthor = (rid) => {
        if (self.reports) {
            let rep = self.reports.find(e => e.id == rid);
            if (rep)
                return (self.users[rep.uid]) ? self.users[rep.uid].name : null;
        }
    };

    self.getAvg = (row) => {
        if(row == null || row.length == 0) return "";
        let s = row.reduce((v,e) => v + e.val, 0);
        return s/row.length;
    };

    self.getInMax = (res) => {
        if(res == null || res.length == 0) return [];
        let n = res.reduce((v,e) => Math.max(v,e.length), 0);
        return new Array(n);
    };

    self.showReport = (rid) => {
        let postdata = {rid: rid};
        $http({url: "get-report", method:"post", data: postdata}).success((data) => {
            $uibModal.open({
                templateUrl: "templ/report-details.html",
                controller: "ReportModalController",
                controllerAs: "vm",
                scope: self,
                resolve: {
                    report: function(){
                        data.author = self.users[data.uid];
                        return data;
                    },
                }
            });
        });
    }

});

adpp.controller("ReportModalController", function ($scope, $uibModalInstance, report) {
    var vm = this;
    vm.report = report;

    vm.cancel = () => {
        $uibModalInstance.dismiss('cancel');
    };

    vm.getAuthor = (uid) => {
        console.log($scope);
    };

});

adpp.controller("GroupController", function ($scope, $http, Notification) {
    let self = $scope;
    self.methods = ["Aleatorio", "Rendimiento Homogeneo", "Rendimiento Heterogeneo", "Tipo Aprendizaje Homogeneo", "Tipo Aprendizaje Heterogeoneo"];
    self.lastI = -1;
    self.lastJ = -1;

    self.shared.verifyGroups = () => {
        self.groupNum = 3;
        self.groupMet = self.methods[0];
        self.groups = [];
        self.groupNames = [];
        if (self.selectedSes != null && self.selectedSes.grouped) {
            self.groupNum = null;
            self.groupMet = null;
            self.generateGroups(true);
        }
    };

    self.generateGroups = (key) => {
        if (key == null && (self.groupNum < 1 || self.groupNum > self.users.length)){
            Notification.error("Error en los parámetros de formación de grupos");
            return;
        }

        let postdata = {
            sesid: self.selectedSes.id,
            gnum: self.groupNum,
            method: self.groupMet
        };

        let urlRequest = "";
        if (self.selectedSes.type == "S")
            urlRequest = "group-proposal-sel";
        else if (self.selectedSes.type == "L")
            urlRequest = "group-proposal-lect";

        if (self.groupMet == "Tipo Aprendizaje Homogeneo" || self.groupMet == "Tipo Aprendizaje Heterogeoneo")
            urlRequest = "group-proposal-hab";
        else if (self.groupMet == "Aleatorio")
            urlRequest = "group-proposal-rand";

        if (urlRequest != "") {
            $http({url: urlRequest, method: "post", data: postdata}).success((data) => {
                self.groups = data;
                self.groupsProp = angular.copy(self.groups);
                console.log(data);
                self.groupNames = [];
                /*data.forEach((d) => {
                 self.groupNames.push(d.map(i => self.users[i.uid].name).join(", "));
                 });*/
            });
        }
    };

    self.acceptGroups = () => {
        if (self.groupsProp == null){
            Notification.error("No hay propuesta de grupos para fijar");
            return;
        }
        let postdata = {
            sesid: self.selectedSes.id,
            groups: JSON.stringify(self.groupsProp.map(e => e.map(f => f.uid)))
        };
        console.log(postdata);
        $http({url: "set-groups", method: "post", data: postdata}).success((data) => {
            if (data.status == "ok") {
                console.log("Groups accepted");
                self.selectedSes.grouped = true;
                self.shared.verifyGroups();
            }
        });
    };

    self.swapTable = (i, j) => {
        console.log(i, j, self.groups);
        if (self.lastI == -1 && self.lastJ == -1) {
            self.lastI = i;
            self.lastJ = j;
            return;
        }
        if (!(self.lastI == i && self.lastJ == j)) {
            let temp = angular.copy(self.groupsProp[i][j]);
            self.groupsProp[i][j] = angular.copy(self.groupsProp[self.lastI][self.lastJ]);
            self.groupsProp[self.lastI][self.lastJ] = temp;
        }
        self.lastI = -1;
        self.lastJ = -1;
    };

});

adpp.controller("RubricaController", function ($scope, $http) {
    let self = $scope;
    self.criterios = [];
    self.newCriterio = {};
    self.editable = false;
    self.exampleReports = [];
    self.newExampleReport = "";

    self.addCriterio = () => {
        self.criterios.push(self.newCriterio);
        self.newCriterio = {};
    };

    self.removeCriterio = (idx) => {
        self.criterios.splice(idx, 1);
    };

    self.checkSum = () => {
        return self.criterios.reduce((e, p) => e + p.pond, 0) == 100;
    };

    self.shared.getRubrica = () => {
        self.criterios = [];
        self.newCriterio = {};
        self.editable = false;
        let postdata = {sesid: self.selectedSes.id};
        $http({url: "get-admin-rubrica", method: "post", data: postdata}).success((data) => {
            if (data.length == 0) {
                self.editable = true;
            }
            else {
                self.criterios = data;
            }
        });
    };

    self.saveRubrica = () => {
        let postdata = {sesid: self.selectedSes.id};
        $http({url: "send-rubrica", method: "post", data: postdata}).success((data) => {
            if (data.status == "ok") {
                let rid = data.id;
                self.criterios.forEach((criterio) => {
                    let postdata = angular.copy(criterio);
                    postdata.rid = rid;
                    $http({url: "send-criteria", method: "post", data: postdata}).success((data) => {
                        if (data.status == "ok") console.log("Ok");
                    });
                });
                self.editable = false;
            }
        });
    };

    self.shared.getExampleReports = () => {
        self.exampleReports = [];
        let postdata = {sesid: self.selectedSes.id};
        $http({url: "get-example-reports", method: "post", data: postdata}).success((data) => {
            self.exampleReports = data;
        });
    };

    self.sendExampleReport = () => {
        let postdata = {
            sesid: self.selectedSes.id,
            content: self.newExampleReport.text,
            title: self.newExampleReport.title
        };
        $http({url: "send-example-report", method: "post", data: postdata}).success((data) => {
            self.newExampleReport = "";
            self.shared.getExampleReports();
        });
    };

    self.setActiveExampleReport = (rep) => {
        let postdata = {sesid: self.selectedSes.id, rid: rep.id};
        $http({url: "set-active-example-report", method: "post", data: postdata}).success((data) => {
            if (data.status == 'ok') {
                self.exampleReports.forEach(r => {
                    r.active = false;
                });
                rep.active = true;
            }
        });
    };

    self.goToReport = (rep) => {
        self.setActiveExampleReport(rep);
        window.location.href = "to-rubrica?sesid=" + self.selectedSes.id;
    };

    self.pairAssign = () => {
        let postdata = {sesid: self.selectedSes.id, rnum: 2};
        $http({url: "assign-pairs", method: "post", data: postdata}).success((data) => {
            if (data.status == "ok") {
                self.selectedSes.paired = true;
                self.errPairMsg = "";
            }
            else {
                self.errPairMsg = data.msg;
            }
        });
    };

});

adpp.controller("DashboardRubricaController", function ($scope, $http) {
    let self = $scope;
    self.reports = [];
    self.result = [];
    self.selectedReport = null;

    self.shared.resetRubricaGraphs = () => {
        self.alumState = null;
        self.barOpts = {
            chart: {
                type: 'multiBarChart',
                height: 320,
                x: d => d.label,
                y: d => d.value,
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
        self.barData = [{key: "Alumnos", color: "#ef6c00", values: []}];
        //self.updateGraph();
    };

    self.shared.resetRubricaGraphs();

});