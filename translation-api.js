
function getXmlHttpRequest(){
	try{
		req = new XMLHttpRequest();
	} catch(err1){
		try{
			req = new ActiveXObject("Msxml2.XMLHTTP");
		}catch (err2){
			try{
				req = new ActiveXObject("Microsoft.XMLHTTP");
			}
			catch(err3){
				req = false;
			}
		}
	}

return req;
}

var xhr = getXmlHttpRequest();

function useHttpResponse(){
	if(xhr.readyState == 4){
		if(xhr.status ==200){
			var x = xhr.responseXML.getElementsByTagName();
			document.getElementsById('').innerHTML = 0;
		}
		else{
			document.getElementsById('').innerHTML = 1;
		}
	}
}

function useMyMemoryREST(textparam){
	var url = "http://mymemory.translated.net/api/get";

	var q = "q=" + textparam;

    var placeholder = "&";
    //console.log("what is q"+q);
	//var q = "q=" + document.getElementById("text").value;

    var fromlang = "en";

    var tolang = "zh-cn";

    //var langpair = "langpair=en|zh-cn";
	var langpair = "langpair" + "=" + fromlang + "|" +"zh-cn";

    var key = "key=etn.Z4ia4g/yo";
  
	var params = q.concat(placeholder,langpair);

	//alert(params);
	//alert(url);

	//xhr.open("POST", url, true);
	//xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
	//xhr.send(params);

}

function useBaiduREST(textparam){
	var url = "http://openapi.baidu.com/public/2.0/bmt/translate";

    var placeholder = "&";
	//var q = "q=" + document.getElementById("text").value;

    var fromlang = "en";

    var tolang = "zh-cn";

    //var langpair = "langpair=en|zh-cn";
	var langpair = "langpair" + "=" + fromlang + "|" +"zh-cn";

    var key = "key=etn.Z4ia4g/yo";
  
	var params = q.concat(placeholder,langpair);

	//alert(params);

	//xhr.open("POST", url, true);
	//xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
	//xhr.send(params);
}

function getBingTokens(){
	var clientId = encode
}

function useBingTranslatorREST(textparam){
	var url = "http://api.microsofttranslator.com/V2/Ajax.svc/Translate?oncomplete=mycallback";
	var datamarketuri = "https://datamarket.accesscontrol.windows.net/v2/OAuth2-13";

    var placeholder = "&";
	var q = "text=" + textparam;	

	//var text = "text=" + document.getElementById("text").value;

    var fromlang = "en";

    var tolang = "zh-cn";

    //var langpair = "langpair=en|zh-cn";

	var langpair = "from" + "=" + fromlang + placeholder +"to" +"=" + tolang;

    //var key = "key=etn.Z4ia4g/yo";
    //var key = "?appId=Bearer T4auhPjF9d0gd2h3EzQDg8nXFpBMUFfo0KyU/w0wdQo=";
    var key = "appId=Bearer " + encodeURIComponent("T4auhPjF9d0gd2h3EzQDg8nXFpBMUFfo0KyU/w0wdQo=")

    //alert(key);
  
	var params = q.concat(placeholder,langpair);
	
	//params = params.concat(placeholder, key);

	//alert(params);

	//assumming jsOAuth.js is loaded successfully here

	/*
	var url = "...";
var accessor = {
  token: "...",
  tokenSecret: "...",
  consumerKey : "...",
  consumerSecret: "..."
};

var message = {
  action: url,
  method: "GET",
  parameters: {...}
};

OAuth.completeRequest(message, accessor);        
OAuth.SignatureMethod.sign(message, accessor);
url = url + '?' + OAuth.formEncode(message.parameters);
*/
	var oauth = OAuth({
      consumerKey: 'AndyWong',
      consumerSecret: 'NENYOBqq+ha4S4RGXuCr+BA2/6hUmZwHM758S7uf+SE='
  	});

  	oauth.post(datamarketuri, {
      'scope': 'http://api.microsofttranslator.com/',
      'grant_type': 'client_credentials'
  	}, successCallback, failureCallback);

	function successCallback(response){
      // contain within is a token of joy
      var token = oauth.parseTokenRequest(response.text);

      var tokenKey = token.oauth_token;
      var tokenSecret = token.oauth_token_secret;

      oauth.setAccessToken(tokenKey, tokenSecret);

      // launch the rest of my application
      app.nowHasTokenCode();
	}

	function failureCallback(response){
      console.error('Something bad happened', response.text);
	}

	window.mycallback = function(response){
		document.getElementById("myDiv").innerHTML +=response;
	}

	
	//for accessing access tokens
	var s = document.createElement("script");
	s.src = url + placeholder + key + placeholder + params;
	alert(s.src);

	document.getElementsByTagName("head")[0].appendChild(s);


	//xhr.open("POST", url, true);
	//xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
	//xhr.send(params);


}

function useCedictresource(handleData)
{
	jQuery(document).ready(function() {
    	jQuery.ajax({
        	url: 'http://localhost:8000/resource/cedict_1_0_ts_utf-8_mdbg.txt',
        	datatype: "jsonp",
        	jsonpCallback: "_testcb",
        	cache: false,
        	timeout: 5000,
        	success: function(data) {
        		handleData(data);
        	},
        	error: function(jqXHR, textStatus, errorThrown) {
        	    alert('error ' + textStatus + " " + errorThrown);
        	}
    	});
	});
}


/***
Decorator Section
*/
/*Web Services to decorate*/
function webServices(url, query){

	this.url = url || "localhost";

	//var arrayparams = []

	this.query = "q="+query;

	//arrayparams.push({query: "q"})

    this.placeholder = "&";

    //arrayparams.push({placeholder: "&"})
    
    this.fromlang = "en";

    //arrayparams.push({fromlang: "en"})

    this.tolang = "zh-cn";
 
 	//arrayparams.push({tolang: "zh-cn"})

    //var langpair = "langpair=en|zh-cn";
	this.langpair = "langpair" + "=" + this.fromlang + "|" + this.tolang;

	//arrayparams.push({langpair: "langpair="+this.fromlang+"|"+this.tolang})

    this.key = "";

    //arrayparams.push({key: ""})
  
	this.params = this.query.concat(this.placeholder,this.langpair);

	//arrayparams.push({params: this.query.concat(this.placeholder, this.langpair)});
	
	this.label = "";

	//arrayparams.push({label: ""})

	xhr.open("POST", url, true);
	xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
	xhr.send(this.params);

	//calls the loadData in the main index.html to handle ajax response/request
	xhr.onreadystatechange = loadData;

}

/*
Decorator 1
*/
function useBing(query){
   //resturl.url = function(){return "http://api.microsofttranslator.com/V2/Ajax.svc/Translate?oncomplete=mycallback"}

}

/*
Decorator 2
*/
function useBaidu(resturl){
   resturl.url = function(){return "http://openapi.baidu.com/public/2.0/bmt/translate"}
}

/*
Decorator 3
*/
function useCedict(resturl){
   //this.url = "localhost"
   //return url
   resturl.url = function(){return "localhost"}
}


/*
Decorator 4
*/
function useMyMemory(resturl){
	//this.url = "http://mymemory.translated.net/api/get"
	//return url
	resturl.url = function(){return "http://mymemory.translated.net/api/get"}
}

//Testing of using my own 'decorators'
//var MyMemoryService = new webServices("http://mymemory.translated.net/api/get", "foo")

