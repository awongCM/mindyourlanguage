function List(obj) {

  if (this instanceof List) {
   var t     = this,
       keys  = [];

    /* inititalize: add the properties of [obj] to the list, 
       and store the keys of [obj] in the private keys array */
    for (var l in obj) {
       keys.push(l);
       t[l] = obj[l];
    }
    /* public:
       add a property to the list 
    */
     t.add = 
         function(key, value) {
              t[key] = value;
              keys.push(key);
              return t; /* allows method chaining */
            };

    /* public:
       return raw or sorted list as string, separated by [separator] 
       Without [sort] the order of properties is the order in which 
       the properties are added to the list
    */
     t.iterate =
       function(sort,separator){
         separator = separator || '\n';
         var ret   = [],
             lkeys = sort ? keys.slice().sort() : keys;

         for (var i=0;i<lkeys.length;i++){
           ret.push(lkeys[i]+': '+t[lkeys[i]]);
         }
       return ret.join(separator);
      };

  } else if (obj && obj instanceof Object) {
     return new List(obj);

  } else if (arguments.length === 2) { 
     var a    = {};
     a[String(arguments[0])] = arguments[1];
     return new List(a);

  } else { return true; }

 /* the 'if (this instanceof List)' pattern makes
    the use of the 'new' operator obsolete. The 
    constructor also allows to be initialized with
    2 parameters => 'List(key,value)' 
 */
}

function Translation(json){
	this.originalclause = json.segment;
	this.translatedclause = json.translation;
}

function createJSONelements(value){
  var jsonarray = []

  //pattern match for translation part
  var regextranslation = /\/.+\//g

  //pattern match for pinyin part
  var regexpinyin = /\[.+\]/g

  //gets translation piece
  var translation = value.match(regextranslation)
            
  console.log(translation.toString());

  value = value.replace(translation, '');

  //gets the pinyin piece
  var pinyin = value.match(regexpinyin);

  console.log(pinyin.toString());

  value = value.replace(pinyin, '');

  console.log(value);

  //gets the remaining character pieces
  var temparray = value.split(/[\s\/]/g)

            
  jsonarray.push({'simplified':temparray[0], 'traditional':temparray[1], 'pinyin': pinyin.toString(), 'translation':translation.toString()});

  console.log("jsonarray: "+JSON.stringify(jsonarray));

  //returns the json array output for that piece of chinese translation output
  return jsonarray;
}

/*
  StringBuilder class for Javascript
*/
function StringBuilder()
{
  var strings = [];

  this.append = function (string)
  {
    string = verify(string);
    if (string.length > 0) strings[strings.length] = string;
  };

  this.appendLine = function (string)
  {
    string = verify(string);
    if (this.isEmpty())
    {
      if (string.length > 0) strings[strings.length] = string;
      else return;
    }
    else strings[strings.length] = string.length > 0 ? "\r\n" + string : "\r\n";
  };

  this.clear = function () { strings = []; };

  this.isEmpty = function () { return strings.length == 0; };

  this.toString = function () { return strings.join(""); };

  var verify = function (string)
  {
    if (!defined(string)) return "";
    if (getType(string) != getType(new String())) return String(string);
    return string;
  };

  var defined = function (el)
  {
    // Changed per Ryan O'Hara's comment:
    return el != null && typeof(el) != "undefined";
  };

  var getType = function (instance)
  {
    if (!defined(instance.constructor)) throw Error("Unexpected object type");
    var type = String(instance.constructor).match(/function\s+(\w+)/);

    return defined(type) ? type[1] : "undefined";
  };
};