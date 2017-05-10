"use strict";

let express = require('express');
let router = express.Router();
let rpg = require("../modules/rest-pg");
let pass = require("../modules/passwords");

let exampleReports = {};

router.get("/rubrica", (req, res) => {
    if (req.session.uid && req.session.ses)
        res.render("rubrica");
    else
        res.redirect(".");
});

router.post("/send-rubrica",rpg.singleSQL({
    //TODO Auth
    dbcon: pass.dbcon,
    sql: "insert into rubricas (sesid) values ($1) returning id",
    sesReqData: ["uid"],
    postReqData: ["sesid"],
    sqlParams: [rpg.param("post","sesid")]
}));

router.post("/send-criteria",rpg.execSQL({
    //TODO Auth
    dbcon: pass.dbcon,
    sql: "insert into criteria (name,pond,inicio,proceso,competente,avanzado,rid) values ($1,$2,$3,$4,$5,$6,$7)",
    sesReqData: ["uid"],
    postReqData: ["name","pond","inicio","proceso","competente","avanzado","rid"],
    sqlParams: [rpg.param("post","name"),rpg.param("post","pond"),rpg.param("post","inicio"),rpg.param("post","proceso"),
        rpg.param("post","competente"),rpg.param("post","avanzado"),rpg.param("post","rid")]
}));

router.post("/get-admin-rubrica",rpg.multiSQL({
    dbcon: pass.dbcon,
    sql: "select c.id, c.name, c.pond, c.inicio, c.proceso, c.competente, c.avanzado from criteria as c, rubricas as r " +
    "where c.rid = r.id and r.sesid = $1",
    sesReqData: ["uid"],
    postReqData: ["sesid"],
    sqlParams: [rpg.param("post","sesid")]
}));

router.post("/get-rubrica",rpg.multiSQL({
    dbcon: pass.dbcon,
    sql: "select c.id, c.name, c.pond, c.inicio, c.proceso, c.competente, c.avanzado from criteria as c, rubricas as r " +
        "where c.rid = r.id and r.sesid = $1",
    sesReqData: ["ses"],
    sqlParams: [rpg.param("ses","ses")]
}));

router.post("/get-criteria-selection",rpg.multiSQL({
    dbcon: pass.dbcon,
    sql: "select id, cid, selection from criteria_selection where uid = $1 and repid = $2",
    sesReqData: ["uid"],
    postReqData: ["rid"],
    sqlParams: [rpg.param("ses","uid"),rpg.param("post","rid")]
}));

router.post("/send-example-report",rpg.execSQL({
    dbcon: pass.dbcon,
    sql: "insert into reports (content,example,rid,uid,title) select $1, true, r.id, $2, $3 from rubricas as r where r.sesid = $4 limit 1",
    sesReqData: ["uid"],
    postReqData: ["sesid","content","title"],
    sqlParams: [rpg.param("post","content"),rpg.param("ses","uid"),rpg.param("post","title"),rpg.param("post","sesid")]
}));

router.post("/get-example-reports", rpg.multiSQL({
    dbcon: pass.dbcon,
    sql: "select r.id, r.title, r.content, r.uid from reports as r, rubricas as b where r.rid = b.id and b.sesid = $1 and r.example = true",
    sesReqData: ["uid"],
    postReqData: ["sesid"],
    sqlParams: [rpg.param("post","sesid")]
}));

router.post("/get-report", rpg.singleSQL({
    dbcon: pass.dbcon,
    sql: "select r.id, r.content, r.uid from reports as r where r.id = $1",
    sesReqData: ["uid"],
    sqlParams: [rpg.param("post","rid")]
}));

router.post("/get-active-example-report", rpg.singleSQL({
    dbcon: pass.dbcon,
    sql: "select r.id, r.content, r.uid from reports as r where r.id = $1",
    sesReqData: ["uid","ses"],
    onStart: (ses, data, calc) => {
        calc.rid = exampleReports[ses.ses];
    },
    sqlParams: [rpg.param("calc","rid")]
}));

router.post("/get-paired-report", rpg.multiSQL({
    dbcon: pass.dbcon,
    sql: "select rp.repid as id, r.content, r.uid from report_pair as rp inner join reports as r on rp.repid = r.id " +
        "inner join rubricas as k on r.rid = k.id where k.sesid = $1 and rp.uid = $2",
    sesReqData: ["uid","ses"],
    sqlParams: [rpg.param("ses","ses"),rpg.param("ses","uid")]
}));

router.post("/send-criteria-selection", rpg.execSQL({
    dbcon: pass.dbcon,
    sql: "with rows as (update criteria_selection set selection = $1 where cid = $2 and uid = $3 and repid = $4 returning 1) " +
        "insert into criteria_selection(selection,cid,uid,repid) select $5,$6,$7,$8 where 1 not in (select * from rows)",
    sesReqData: ["uid"],
    postReqData: ["sel","rid","cid"],
    sqlParams: [rpg.param("post","sel"),rpg.param("post","cid"),rpg.param("ses","uid"),rpg.param("post","rid"),
        rpg.param("post","sel"),rpg.param("post","cid"),rpg.param("ses","uid"),rpg.param("post","rid")]
}));

router.post("/set-active-example-report", (req,res) => {
    if(req.session.uid == null || req.body.rid == null || req.body.sesid == null || req.session.role == null || req.session.role != 'P'){
        res.end('{"status":"err"}');
        return;
    }
    exampleReports[req.body.sesid] = req.body.rid;
    res.end('{"status":"ok"}');
});

router.post("/send-report", rpg.execSQL({
    dbcon: pass.dbcon,
    sql: "with rows as (update reports as r set content = $1 from rubricas as b where r.uid = $2 and r.rid = b.id and b.sesid = $3 returning 1) " +
        "insert into reports(content,uid,example,rid) select $4,$5,false,id from rubricas as t where t.sesid = $6 and 1 not in (select * from rows)",
    sesReqData: ["uid","ses"],
    postReqData: ["content"],
    sqlParams: [rpg.param("post","content"),rpg.param("ses","uid"),rpg.param("ses","ses"),rpg.param("post","content"),rpg.param("ses","uid"),rpg.param("ses","ses")]
}));

router.post("/send-report-comment", rpg.execSQL({
    dbcon: pass.dbcon,
    sql: "with rows as (update report_comment as r set comment = $1 where r.uid = $2 and r.repid = $3 returning 1) " +
    "insert into report_comment(comment,uid,repid) select $4,$5,$6 where 1 not in (select * from rows)",
    sesReqData: ["uid","ses"],
    postReqData: ["rid","text"],
    sqlParams: [rpg.param("post","text"),rpg.param("ses","uid"),rpg.param("post","rid"),rpg.param("post","text"),rpg.param("ses","uid"),rpg.param("post","rid")]
}));

router.post("/get-my-report", rpg.singleSQL({
    dbcon: pass.dbcon,
    sql: "select r.id, r.content from reports as r, rubricas as b where r.uid = $1 and b.id = r.rid and b.sesid = $2",
    sesReqData: ["uid","ses"],
    sqlParams: [rpg.param("ses","uid"),rpg.param("ses","ses")]
}));

router.post("/get-report-list", rpg.multiSQL({
    dbcon: pass.dbcon,
    sql: "select r.id, r.example, r.uid from reports as r inner join rubricas as ru on ru.id = r.rid and ru.sesid = $1",
    postReqData: ["sesid"],
    sqlParams: [rpg.param("post","sesid")]
}));

router.post("/get-report-result", rpg.multiSQL({
    dbcon: pass.dbcon,
    sql: "select cs.id, cs.selection, cs.uid, c.pond from criteria_selection as cs inner join criteria as c on cs.cid = c.id where cs.repid = $1",
    postReqData: ["repid"],
    sqlParams: [rpg.param("post","repid")],
    onEnd: (req,res,arr) => {
        let d = {};
        arr.forEach((row) => {
             if(d[row.uid] == null)
                 d[row.uid] = row.selection * row.pond * 0.01;
             else
                 d[row.uid] += row.selection * row.pond * 0.01;
        });
        let resArr = Object.keys(d).map(u => {return {uid: u, val: d[u]}});
        res.end(JSON.stringify(resArr));
    }
}));

router.post("/get-report-result-all", rpg.multiSQL({
    dbcon: pass.dbcon,
    sql: "select r.id as repid, cs.id, cs.selection, cs.uid, c.pond from criteria_selection as cs inner join criteria as c on cs.cid = c.id " +
        "inner join reports as r on r.id = cs.repid inner join rubricas as rb on r.rid = rb.id where rb.sesid = $1 and r.example = false",
    postReqData: ["sesid"],
    sqlParams: [rpg.param("post","sesid")],
    onEnd: (req,res,arr) => {
        let d = {};
        arr.forEach((row) => {
            if(d[row.repid] == null)
                d[row.repid] = {};
            if(d[row.repid][row.uid] == null)
                d[row.repid][row.uid] = row.selection * row.pond * 0.01;
            else
                d[row.repid][row.uid] += row.selection * row.pond * 0.01;
        });
        let resArr = Object.keys(d).map(repObj => {
            return Object.keys(d[repObj]).map(u => {
                return {uid: u, val: d[repObj][u]};
            })
        });
        console.log(d);
        res.end(JSON.stringify(resArr));
    }
}));

module.exports = router;