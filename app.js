var express=require('express')
var app=express()
var https=require('https')
var port=3000
var fs=require('fs')

app.get('/webhook',function(req,res){
	console.log(req.query['hub.verify_token'])
	if (req.query['hub.verify_token'] === 'funstuff') {
      res.send(req.query['hub.challenge']);
    } else {
      res.send('Error, wrong validation token');    
    }
	res.send('Hello World!')
})

var httpsOptions={
	key:fs.readFileSync('./server.key'),
	cert:fs.readFileSync('./server.crt')
}

var server=https.createServer(httpsOptions,app).listen(port,function(){
	console.log('Example app listening on port 3000!')
})