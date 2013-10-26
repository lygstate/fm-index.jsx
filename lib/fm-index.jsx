/**
 * This is a JSX version of shellinford library:
 * https://code.google.com/p/shellinford/
 *
 * License: http://shibu.mit-license.org/
 */

import "console.jsx";
import "wavelet-matrix.jsx";
import "burrows-wheeler-transform.jsx";
import "binary-support.jsx";
import "binary-io.jsx";

abstract class _impl
{
    var fmi : FMIndex;
    function constructor (fmi : FMIndex)
    {
        this.fmi = fmi;
    }
    abstract function clear () : void;
    abstract function size () : int;
    abstract function rank (pos : int, code : int) : int;
    abstract function get (pos : int) : int;
    abstract function build(maxChar : int, s : string) : void;
    abstract function dump(output : BinaryOutput) : void;
    abstract function load(input : BinaryInput) : void;
}

class _uint32impl extends _impl
{
    var _sv : Uint32WaveletMatrix;
    function constructor (fmi : FMIndex)
    {
        super(fmi);
        this._sv = new Uint32WaveletMatrix();
    }
    override function clear () : void
    {
        this._sv.clear();
    }
    override function size () : int
    {
        return this._sv.size();
    }
    override function rank (pos : int, code : int) : int
    {
        return this._sv.rank(pos, code);
    }
    override function get (pos : int) : int
    {
        return this._sv.get(pos);
    }
    override function build (maxChar : int, s : string) : void
    {
        this._sv.setMaxCharCode(maxChar);
        this._sv.build(s);
        for (var c = 0; c < maxChar; c++)
        {
            this.fmi._rlt[c] = this._sv.rankLessThan(this._sv.size(), c);
        }
    }
    override function dump (output : BinaryOutput) : void
    {
        this._sv.dump(output);
    }
    override function load (input : BinaryInput) : void
    {
        this._sv.load(input);
        var maxChar = this._sv.maxCharCode();
        for (var c = 0; c < maxChar; c++)
        {
            this.fmi._rlt[c] = this._sv.rankLessThan(this._sv.size(), c);
        }
    }
}

class _arrayimpl extends _impl
{
    var _sv : ArrayWaveletMatrix;
    function constructor (fmi : FMIndex)
    {
        super(fmi);
        this._sv = new ArrayWaveletMatrix();
    }
    override function clear () : void
    {
        this._sv.clear();
    }
    override function size () : int
    {
        return this._sv.size();
    }
    override function rank (pos : int, code : int) : int
    {
        return this._sv.rank(pos, code);
    }
    override function get (pos : int) : int
    {
        return this._sv.get(pos);
    }
    override function build (maxChar : int, s : string) : void
    {
        this._sv.setMaxCharCode(maxChar);
        this._sv.build(s);
        for (var c = 0; c < maxChar; c++)
        {
            this.fmi._rlt[c] = this._sv.rankLessThan(this._sv.size(), c);
        }
    }
    override function dump (output : BinaryOutput) : void
    {
        this._sv.dump(output);
    }
    override function load (input : BinaryInput) : void
    {
        this._sv.load(input);
        var maxChar = this._sv.maxCharCode();
        for (var c = 0; c < maxChar; c++)
        {
            this.fmi._rlt[c] = this._sv.rankLessThan(this._sv.size(), c);
        }
    }
}

__export__ class FMIndex
{
    var _substr : string;
    var _ddic : int;
    var _ssize : int;
    var _head : int;
    var _impl : _impl;
    var _posdic : int[];
    var _idic : int[];
    var _rlt : int[];

    function constructor ()
    {
        this._ddic = 0,
        this._head = 0;
        this._substr = "";
        if (BinarySupport.uint8array)
        {
            this._impl = new _uint32impl(this);
        }
        else
        {
            this._impl = new _arrayimpl(this);
        }
        this._posdic = [] : int[];
        this._idic = [] : int[];
        this._rlt = [] : int[];
        this._rlt.length = 65536;
    }

    function clear () : void
    {
        this._impl.clear();
        this._posdic.length = 0;
        this._idic.length = 0;
        this._ddic = 0;
        this._head = 0;
        this._substr = "";
    }

    function size () : int
    {
        return this._impl.size();
    }

    function contentSize () : int
    {
        return this._substr.length;
    }
    __noexport__ function getRows (key : string) : int
    {
        return this.getRows(key, null);
    }
    function getRows (key : string, pos : int[]) : int
    {
        var i = key.length - 1;
        var code = key.charCodeAt(i);
        var first = this._rlt[code] + 1;
        var last  = this._rlt[code + 1];
        while (first <= last)
        {
            if (i == 0)
            {
                if (pos)
                {
                    pos[0] = --first;
                    pos[1] = --last;
                }
                return (last - first  + 1);
            }
            i--;
            var c = key.charCodeAt(i);
            first = this._rlt[c] + this._impl.rank(first - 1, c) + 1;
            last  = this._rlt[c] + this._impl.rank(last,      c);
        }
        return 0;
    }

    function getPosition (i : int) : int
    {
        if (i >= this.size())
        {
            throw new Error("FMIndex.getPosition() : range error");
        }
        var pos = 0;
        while (i != this._head)
        {
            if ((i % this._ddic) == 0)
            {
                pos += (this._posdic[i / this._ddic] + 1);
                break;
            }
            var c = this._impl.get(i);
            i = this._rlt[c] + this._impl.rank(i, c); //LF
            pos++;
        }
        return pos % this.size();
    }

    function getSubstring (pos : int, len : int) : string
    {
        if (pos >= this.size())
        {
            throw new Error("FMIndex.getSubstring() : range error");
        }
        var pos_end  = Math.min(pos + len, this.size());
        var pos_tmp  = this.size() - 1;
        var i        = this._head;
        var pos_idic = Math.floor((pos_end + this._ddic - 2) / this._ddic);
        if (pos_idic < this._idic.length)
        {
            pos_tmp = pos_idic * this._ddic;
            i       = this._idic[pos_idic];
        }

        var substr = "";
        while (pos_tmp >= pos)
        {
            var c = this._impl.get(i);
            i = this._rlt[c] + this._impl.rank(i, c); //LF
            if (pos_tmp < pos_end)
            {
                substr = String.fromCharCode(c) + substr;
            }
            if (pos_tmp == 0)
            {
                break;
            }
            pos_tmp--;
        }
        return substr.replace(String.fromCharCode(0), '');
    }
    __noexport__ function build(ddic : int) : void
    {
        this.build(ddic, null);
    }
    function build(ddic : int, maxChar : Nullable.<int>) : void
    {
        if (maxChar == null)
        {
            maxChar = 65535;
        }
        var bwt = new BurrowsWheelerTransform(this._substr);
        var s = bwt.get();
        this._ssize = s.length;
        this._head = bwt.head();
        this._substr = "";
        this._impl.build(maxChar, s);
        this._ddic = ddic;
        this._buildDictionaries();
    }

    function _buildDictionaries () : void
    {
        for (var i = 0; i < (this._ssize / this._ddic + 1); i++)
        {
            this._posdic.push(0);
            this._idic.push(0);
        }
        var i = this._head;
        var pos = this.size() - 1;
        do {
            if ((i % this._ddic) == 0)
            {
                this._posdic[Math.floor(i / this._ddic)] = pos;
            }
            if ((pos % this._ddic) == 0)
            {
                this._idic[Math.floor(pos / this._ddic)] = i;
            }
            var c = this._impl.get(i);
            i = this._rlt[c] + this._impl.rank(i, c); //LF
            pos--;
        } while (i != this._head);
    }

    function push (doc : string) : void
    {
        if (doc.length <= 0)
        {
            throw new Error("FMIndex::push(): empty string");
        }
        this._substr += doc;
    }

    function search (keyword : string) : int[]
    {
        var result = [] : int[];
        var position = [] : int[];
        var rows = this.getRows(keyword, position);
        if (rows > 0)
        {
            var first = position[0];
            var last = position[1];
            for (var i = first; i <= last; i++)
            {
                result.push(this.getPosition(i));
            }
        }
        return result;
    }

    function dump (output : BinaryOutput) : void
    {
        output.dump32bitNumber(this._ddic);
        output.dump32bitNumber(this._ssize);
        output.dump32bitNumber(this._head);
        this._impl.dump(output);
        output.dump32bitNumber(this._posdic.length);
        for (var i in this._posdic)
        {
            output.dump32bitNumber(this._posdic[i]);
        }
        for (var i in this._idic)
        {
            output.dump32bitNumber(this._idic[i]);
        }
    }

    function load (input : BinaryInput) : void
    {
        this._ddic = input.load32bitNumber();
        this._ssize = input.load32bitNumber();
        this._head = input.load32bitNumber();
        this._impl.load(input);
        var size = input.load32bitNumber();
        for (var i = 0; i < size; i++)
        {
            this._posdic.push(input.load32bitNumber());
        }
        for (var i = 0; i < size; i++)
        {
            this._idic.push(input.load32bitNumber());
        }
    }
}
