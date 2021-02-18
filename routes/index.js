const express = require('express');
const router = express.Router();

let offers = {};
router.get('/offer/:id', (req, res) => {
    const { id } = req.params;
    if(offers[id]) {
        res.json(offers[id]);
        delete offers[id];
    } else {
        res.sendStatus(404);
    }
});

router.post('/offer/:id', (req, res) => {
    const { id } = req.params;
    offers[id] = req.body;
    res.sendStatus(200);
});

let answers = {};
router.get('/answer/:id', (req, res) => {
    const { id } = req.params;
    if(answers[id]) {
        res.json(answers[id]);
        delete answers[id];
    } else {
        res.sendStatus(404);
    }
});

router.post('/answer/:id', (req, res) => {
    const { id } = req.params;
    answers[id] = req.body;
    res.sendStatus(200);
});

module.exports = router;
