var express=require('express');
var bodyParser=require('body-parser');
var app=express();
var https=require('https');
var request=require('request');
var port=3000;
var fs=require('fs');

app.use(bodyParser.json());

app.get('/',function(req,res){
	if (req.query['hub.mode'] === 'subscribe' &&
		req.query['hub.verify_token'] === 'this_is_fun') {
		console.log("Validating webhook");
		res.status(200).send(req.query['hub.challenge']);
	} else {
		console.error("Failed validation. Make sure the validation tokens match.");
    	res.sendStatus(403);          
  	}  
  	res.send('Hello World!');
});

app.post('/webhook',function(req,res){
	console.log(req.body);
	var data=req.body;
	console.log("Hi hello");
	if (data.object === 'page'){

		data.entry.forEach(function(entry){
			var pageID=entry.id;
			var timeOfEvent=entry.time;

			entry.messaging.forEach(function(event){
				console.log(entry.messaging);
				if(event.message){
					receivedMessage(event);
				}else{
					console.log("Webhook received unknown event:",event);
				}
			});
		});
		res.sendStatus(200);
	}
});

function receivedMessage(event){
	var senderID=event.sender.id;
	var recipientID=event.recipient.id;
	var timeOfMessage=event.timestamp;
	var message=event.message;

	console.log("Received message from %d user and %d page at %d time",senderID,recipientID,
		timeOfMessage);

	console.log(JSON.stringify(message));

	var messageId=message.mid;
	var messageText=message.text;
	var messageAttachments=message.attachments;

	console.log(messageId,message.text,message.attachments);
	if(messageText){
		switch(messageText){
			case 'generic':
				sendGenericMessage(senderID);
				break;

			default:
				sendTextMessage(senderID,messageText);
		}
	}else if(messageAttachments){
		sendTextMessage(senderID,"Message with attachments received");
	}
}

function sendTextMessage(recipientID,messageText){
	var upcomingMatchesData={
		apikey:"qMdsykxRTkft5pvwqdaqOI8D6Sm2"
	};
	getUpcomingMatches(upcomingMatchesData);
	var messageData={
		recipient:{
			id:recipientID
		},
		message:{
			text:messageText
		}
	};

	callSendAPI(messageData);
}

function getUpcomingMatches(upcomingMatchesData){
	request({
		uri:'http://cricapi.com/api/matches',
		method:'POST',
		json:upcomingMatchesData
	},function(error,response,body){
		console.log(body.matches[0].unique_id);
		if(!error && response.statusCode==200){
			console.log("Successfully retrieved upcoming matches");
		}
		else{
			console.error("Unable to retrieve list of upcoming matches");
			console.error(response);
			console.error(error);
		}
	});
}
function callSendAPI(messageData){
	request({
		uri:'https://graph.facebook.com/v2.6/me/messages',
		qs:{access_token:'EAAShs2WgQs4BAPHiSB7CyjrbLECpuaTbsGbX2kf7DY9HEpENF3MAYmfqTMrxhzPEJpajXnz3lNnBtn1x9xBNesqoopWvqJd40MhUVM07BhN1I0FkhUK4Ew8ZBqjOAgl046zVss20luPOm6brnuurJlaXi9yQWOgfGvuoNawZDZD'},
		method:'POST',
		json:messageData
	},function(error,response,body){
		console.log(body);
		if(!error && response.statusCode==200){
			var recipientID=body.recipient_id;
			var messageID=body.message_id;
			console.log("Successfully sent message with id %s to recipient %s",messageID,recipientID);
		}
		else{
			console.error("Unable to send message");
			console.error(response);
			console.error(error);
		}
	});
}

app.listen(process.env.PORT,function(){
	console.log('Example app listening on port 3000!')
});