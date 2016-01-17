import "console.jsx";

__export__ class BinaryInput
{
    var _buffer : string;
    var _offset : int;

    function constructor (buffer : string)
    {
        this._buffer = buffer;
        this._offset = 0;
    }

    __noexport__ function constructor (buffer : string, offset : int)
    {
        this._buffer = buffer;
        this._offset = offset;
    }

    function load32bitNumber () : number
    {
        return this._buffer.charCodeAt(this._offset++) + this._buffer.charCodeAt(this._offset++) * 65536;
    }

    function load16bitNumber () : int
    {
        return this._buffer.charCodeAt(this._offset++);
    }

    function loadString () : string
    {
        var strLength = this.load16bitNumber();
        var offset = this._offset;
        var data = this._buffer;
        if (strLength > 32767)
        {
            strLength = strLength - 32768;
            var result = '';

            for (var i = 0; i < strLength; i += 2)
            {
                var code = data.charCodeAt(offset);
                result += String.fromCharCode(code & 0x00ff);
                if (i != strLength - 1)
                {
                    result += String.fromCharCode(code >>> 8);
                }
                offset++;
            }
            this._offset = offset;
            return result;
        }
        else
        {
            this._offset += strLength;
            return data.slice(offset, offset + strLength);
        }
    }

    function loadStringList () : string[]
    {
        var result = [] : string[];

        var length = this.load32bitNumber();
        for (var i = 0; i < length; i++)
        {
            var strLength = this.load16bitNumber();
            var resultStr : string;
            if (strLength > 32767)
            {
                var strLength = strLength - 32768;
                resultStr = '';
                for (var j = 0; j < strLength; j += 2)
                {
                    var code = this.load16bitNumber();
                    resultStr += String.fromCharCode(code & 0x00ff);
                    if (j != strLength - 1)
                    {
                        resultStr += String.fromCharCode(code >>> 8);
                    }
                }
            }
            else
            {
                resultStr = this._buffer.slice(this._offset, this._offset + strLength);
                this._offset += strLength;
            }
            result.push(resultStr);
        }
        return result;
    }

    function loadStringListMap () : Map.<string[]>
    {
        var result = {} : Map.<string[]>;

        var length = this.load32bitNumber();
        for (var i = 0; i < length; i++)
        {
            var keyResult = this.loadString();
            var valueResult = this.loadStringList();
            result[keyResult] = valueResult;
        }

        return result;
    }

    function load32bitNumberList () : number[]
    {
        var resultLength = this.load32bitNumber();
        var result = [] : number[];
        while (result.length < resultLength)
        {
            var tag = this.load16bitNumber();
            if ((tag >>> 15) == 1) // zebra
            {
                var length = Math.min(resultLength - result.length, 15);
                for (var i = 0; i < length; i++)
                {
                    if ((tag >>> i) & 0x1)
                    {
                        result.push(this.load32bitNumber());
                    }
                    else
                    {
                        result.push(0);
                    }
                }
            }
            else if ((tag >>> 14) == 1) // non-zero
            {
                var length = tag - 0x4000 + 1;
                for (var i = 0; i < length; i++)
                {
                    result.push(this.load32bitNumber());
                }
            }
            else // zero
            {
                var length = tag + 1;
                for (var i = 0; i < length; i++)
                {
                    result.push(0);
                }
            }
        }
        return result;
    }
}

__export__ class BinaryOutput
{
    var _output : string;

    function constructor ()
    {
        this._output = '';
    }

    function dumpRawString (str : string) : void
    {
        this._output += str;
    }

    function dump32bitNumber (num : number) : void
    {
        this._output += String.fromCharCode(num % 65536) + String.fromCharCode(Math.floor(num / 65536));
    }

    static function convert32bitNumber (num : number) : string
    {
        return String.fromCharCode(num % 65536) + String.fromCharCode(Math.floor(num / 65536));
    }

    function dump16bitNumber (num : int) : void
    {
        this._output += String.fromCharCode(num % 65536);
    }

    static function convert16bitNumber (num : int) : string
    {
        return String.fromCharCode(num % 65536);
    }

    function dumpString (str : string) : void
    {
        this._output += BinaryOutput.convertString(str);
    }

    static function convertString (str : string) : string
    {
        var result : string;
        if (str.length > 32768)
        {
            str = str.slice(0, 32768);
        }
        var length = str.length;
        var compress = true;
        var charCodes = [] : int[];
        for (var i = 0; i < length; i++)
        {
            var charCode = str.charCodeAt(i);
            if (charCode > 255)
            {
                compress = false;
                break;
            }
            charCodes.push(charCode);
        }
        if (compress)
        {
            result = BinaryOutput.convert16bitNumber(length + 32768);
            for (var i = 0; i < length; i += 2)
            {
                var bytes = charCodes[i];
                if (i != length - 1)
                {
                    bytes += charCodes[i + 1] << 8;
                }
                result += BinaryOutput.convert16bitNumber(bytes);
            }
        }
        else
        {
            result = BinaryOutput.convert16bitNumber(length) + str;
        }
        return result;
    }

    function dumpStringList (strList : string[]) : void
    {
        this.dump32bitNumber(strList.length);
        for (var i = 0; i < strList.length; i++)
        {
            this.dumpString(strList[i]);
        }
    }

    function dumpStringListMap (strMap : Map.<string[]>) : void
    {
        var counter = 0;
        var tmpOutput = this._output;
        this._output = '';
        for (var key in strMap)
        {
            this.dumpString(key);
            this.dumpStringList(strMap[key]);
            counter++;
        }
        this._output = tmpOutput + BinaryOutput.convert32bitNumber(counter) + this._output;
    }

    function dump32bitNumberList (array : number[]) : void
    {
        this.dump32bitNumber(array.length);
        var index = 0;
        var inputLength = array.length;
        while (index < inputLength)
        {
            if (array[index] == 0)
            {
                var length = this._countZero(array, index);
                this._zeroBlock(length);
                index += length;
            }
            else if (this._shouldZebraCode(array, index))
            {
                this._createZebraCode(array, index);
                index = Math.min(array.length, index + 15);
            }
            else
            {
                var length = this._searchDoubleZero(array, index);
                this._nonZeroBlock(array, index, length);
                if (length == 0)
                {
                    throw new Error('');
                }
                index += length;
            }
        }
    }

    function _countZero (array : number[], offset : int) : int
    {
        for (var i = offset; i < array.length; i++)
        {
            if (array[i] != 0)
            {
                return i - offset;
            }
        }
        return array.length - offset;
    }

    function _zeroBlock (length : int) : string
    {
        var result = [] : string[];
        while (length > 0)
        {
            if (length > 16384)
            {
                this.dump16bitNumber(16384 - 1);
                length -= 16384;
            }
            else
            {
                this.dump16bitNumber(length - 1);
                length = 0;
            }
        }
        return result.join('');
    }

    function _shouldZebraCode(array : number[], offset : int) : boolean
    {
        if (array.length - offset < 16)
        {
            return true;
        }
        var change = 0;
        var isLastZero = false;
        for (var i = offset; i < offset + 15; i++)
        {
            if (array[i] == 0)
            {
                if (!isLastZero)
                {
                    isLastZero = true;
                    change++;
                }
            }
            else
            {
                if (isLastZero)
                {
                    isLastZero = false;
                    change++;
                }
            }
        }
        return change > 2;
    }

    function _searchDoubleZero (array : number[], offset : int) : int
    {
        var isLastZero = false;
        for (var i = offset; i < array.length; i++)
        {
            if (array[i] == 0)
            {
                if (isLastZero)
                {
                    return i - offset - 1;
                }
                isLastZero = true;
            }
            else
            {
                isLastZero = false;
            }
        }
        return array.length - offset;
    }

    function _nonZeroBlock (array : number[], offset : int, length : int) : void
    {
        while (length > 0)
        {
            var blockLength : int;
            if (length > 16384)
            {
                blockLength = 16384;
                length -= 16384;
            }
            else
            {
                blockLength = length;
                length = 0;
            }
            this.dump16bitNumber((blockLength - 1) + 0x4000);
            for (var i = offset; i < offset + blockLength; i++)
            {
                this.dump32bitNumber(array[i]);
            }
            offset += blockLength;
        }
    }

    function _createZebraCode (array : number[], offset : int) : void
    {
        var last = Math.min(offset + 15, array.length);
        var code = 0x8000;
        var tmpOutput = this._output;
        this._output = '';
        for (var i = offset; i < last; i++)
        {
            if (array[i] != 0)
            {
                this.dump32bitNumber(array[i]);
                code = code + (0x1 << (i - offset));
            }
        }
        this._output = tmpOutput + String.fromCharCode(code) + this._output;
    }

    function result() : string
    {
        return this._output;
    }
}
