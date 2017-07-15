var express=require('express');
var bodyParser=require('body-parser');
var app=express();
var https=require('https');
var request=require('request');
var port=3000;
var fs=require('fs');
var moment=require('moment');
var config=require('config');
require('moment/locale/en-gb')

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
	var data=req.body;
	if (data.object === 'page'){

		data.entry.forEach(function(entry){
			var pageID=entry.id;
			var timeOfEvent=entry.time;

			entry.messaging.forEach(function(event){
				if(event.message){
					receivedMessage(event);
				}else if (event.postback) {
					receivedPostback(event);
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

function sendGenericMessage(recipientID){
	getCurrentMatches(function(allCurrentMatches){
		var arraySlices=1;
		var matchList=[];
		console.log(allCurrentMatches.length)
		if(allCurrentMatches.length>10){
			arraySlices=2;
		}
		for (var i = 0; i < arraySlices; i++) {
			if(i===0){
				matchList=allCurrentMatches.slice(0,9);
			}
			else if(i===1){
				matchList=allCurrentMatches.slice(10,allCurrentMatches.length-1)
			}
			var matchElements=[];
			matchList.some(function(match,index){
				var matchObject={};
				matchObject.title=match.TEAM_1+" vs "+match.TEAM_2;
				matchObject.subtitle=match.MATCH_DETAILS+"\n"+match.MATCH_STATUS;
				//matchObject.image_url=config.get('image_url.'+matchDetails.matchTitle);
				var buttons=[];
				var buttonObject={};
				buttonObject.type="postback";
				buttonObject.title="Get Scores";
				buttonObject.payload="PAYLOAD_"+match.MATCH_ID
				buttons.push(buttonObject);
				matchObject.buttons=buttons;
				matchElements.push(matchObject);
			});
			console.log(matchElements);
			if(matchElements.length>0){
				var messageData={
					recipient:{
						id:recipientID
					},
					message:{
						attachment:{
							type:"template",
							payload:{
								template_type:"generic",
								elements:matchElements
							}
						}
					}
				};
				callSendAPI(messageData);
			}
			else{
				var messageData={
					recipient:{
						id:recipientID
					},
					message:{
						text:"There are no ongoing matches!"
					}
				};
				callSendAPI(messageData);
			}
		}		
	})
	
}
function sendReply(recipientID,messageText){
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
function sendTextMessage(recipientID,messageText){
	getUpcomingMatches(function(message){
		var messageData={
			recipient:{
				id:recipientID
			},
			message:{
				text:message
			}
		};
		callSendAPI(messageData);
	});
}

function getUpcomingMatches(callback){
	var upcomingMatchesData={
		apikey:"qMdsykxRTkft5pvwqdaqOI8D6Sm2"
	};
	request({
		uri:'http://cricapi.com/api/matches',
		method:'POST',
		json:upcomingMatchesData
	},function(error,response,body){
		//console.log(body.matches[0].unique_id);
		if(!error && response.statusCode==200){
			var teamOne=body.matches[0]["team-1"];
			var teamTwo=body.matches[0]["team-2"];
			callback(body.matches);
			//console.log(teamOne);
			//console.log(teamTwo);
			console.log("Successfully retrieved upcoming matches");
		}
		else{
			console.error("Unable to retrieve list of upcoming matches");
			console.error(response);
			console.error(error);
		}
	});
}
//&& match.unique_id.indexOf('will generate') < 0
function getCurrentMatches(callback){
	request({
		uri:'https://cricket-api-info.herokuapp.com/currentMatches',
		method:'GET',
		json:true
	},function(error,response,body){
		//console.log(body.matches[0].unique_id);
		if(!error && response.statusCode==200){
			var matches=body;
			console.log("TODAY MATCHES - ");
			console.log(matches);
			callback(matches);
		}
		else{
			console.error("Unable to retrieve current matches");
			console.error(response);
			console.error(error);
		}
	});
}

function getUniqueId(callback,matchesWithNoId){
	getUpcomingMatches(function(matches){
		matchesWithNoId.forEach(function(match){
			//var versusString=match.name.indexOf(' v ');
			//var atString=match.name.indexOf(' at ');
			//var teamOne=match.name.slice(0,versusString);
			//var teamTwo=match.name.slice(versusString+3,atString);
			var teamOne,teamTwo;
			getMatchDetails(function(matchDetails){
				teamOne=matchDetails.teamOne;
				teamTwo=matchDetails.teamTwo;
				console.log(teamOne,teamTwo);
			},match);
			var filterMatches=matches.filter(function(match){
				return ((match["team-1"]===teamOne || match["team-1"]===teamTwo) && (match["team-2"]===teamOne || match["team-2"]===teamTwo));
			});
			if(filterMatches.length>0){
				match.unique_id=filterMatches[0].unique_id;
				match.matchStarted=filterMatches[0].matchStarted;
			}
			else{
				match.matchStarted=false;
			}
		});
		callback(matchesWithNoId);
	});
	
}

function getMatchDetails(callback,match){
	var matchDetails={};
	var versusString=match.name.indexOf(' v ');
	var atString=match.name.indexOf(' at ');
	var commaString=match.name.indexOf(', ');
	matchDetails.teamOne=match.name.slice(0,versusString);
	matchDetails.teamTwo=match.name.slice(versusString+3,atString);
	matchDetails.matchTitle=match.name.slice(0,atString);
	matchDetails.venue=match.name.slice(atString+4,commaString);
	matchDetails.seriesInformation=match.name.slice(commaString+2,match.name.length);
	console.log(matchDetails);
	console.log(matchDetails[2]);
	callback(matchDetails);
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

function receivedPostback(event){
	var senderID=event.sender.id;
	var recipientID=event.recipient.id;
	var timeOfPostback=event.timestamp;

	var payload=event.postback.payload;
	console.log("Received postback for user %d and page %d with payload '%s'",senderID,recipientID,payload);
	if(payload==='GET_STARTED_PAYLOAD'){
		sendReply(senderID,"Welcome to TestSports! Select an option from the below menu.");
	}
	if(payload==='CURRENT_INTERNATIONAL_PAYLOAD'){
		sendGenericMessage(senderID);
	}

}

app.listen(process.env.PORT,function(){
	console.log('Example app listening on port 3000!')
});