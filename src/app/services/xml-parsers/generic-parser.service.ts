import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { map, scan } from 'rxjs/operators';
import { AttributesData, NamedEntitiesList, XMLElement } from '../../models/evt-models';
import { CommentData, GenericElementData, HTMLData, NoteData, TextData } from '../../models/parsed-elements';
import { isNestedInElem, xpath } from '../../utils/dom-utils';
import { replaceMultispaces } from '../../utils/xml-utils';

export type ParsedElement = HTMLData | TextData | GenericElementData | CommentData | NoteData | NamedEntitiesList;

function complexElements(nodes: NodeListOf<ChildNode>): ChildNode[] {
  return Array.from(nodes).filter((n) => n.nodeType !== 8);
}

@Injectable()
export class GenericParserService {

  addTask = new Subject<number>();

  tasksInQueue = this.addTask.pipe(
    scan((x, y) => x + y, 0),
  );

  isBusy = this.tasksInQueue.pipe(
    map((n) => n !== 0),
  );

  parseF = {
    note: this.parseNote,
  };

  parse(xml: XMLElement): ParsedElement {
    if (!xml) { return { content: [xml] } as HTMLData; }
    // Text Node
    if (xml.nodeType === 3) { return this.parseText(xml); }
    // Comment
    if (xml.nodeType === 8) { return {} as CommentData; }
    const tagName = xml.tagName.toLowerCase();
    const parseFunction = this.parseF[tagName] || this.parseElement;

    return parseFunction.call(this, xml);
  }

  private parseText(xml: XMLElement): TextData {
    const text = {
      type: 'TextComponent',
      text: replaceMultispaces(xml.textContent),
      attributes: {},
    } as TextData;

    return text;
  }

  private parseElement(xml: XMLElement): GenericElementData {
    const genericElement: GenericElementData = {
      type: 'GenericElementComponent',
      class: xml.tagName ? xml.tagName.toLowerCase() : '',
      content: this.parseChildren(xml),
      attributes: this.parseAttributes(xml),
    };

    return genericElement;
  }

  private parseNote(xml: XMLElement): NoteData {
    if (isNestedInElem(xml, 'div', [{ key: 'type', value: 'footer' }]) // FOOTER NOTE
      || isNestedInElem(xml, 'person') || isNestedInElem(xml, 'place') || isNestedInElem(xml, 'org')
      || isNestedInElem(xml, 'relation') || isNestedInElem(xml, 'event') // NAMED ENTITY NOTE
    ) {
      return this.parseElement(xml);
    }
    const noteElement = {
      type: 'NoteComponent',
      path: xpath(xml),
      content: this.parseChildren(xml),
      attributes: this.parseAttributes(xml),
    };

    return noteElement;

  }

  private parseChildren(xml: XMLElement) {
    return complexElements(xml.childNodes).map(child => this.parse(child as XMLElement));
  }

  public parseAttributes(xml: XMLElement): AttributesData {
    return Array.from(xml.attributes)
      .map(({name, value}) => ({ [name === 'xml:id' ? 'id' : name.replace(':', '-')]: value }))
      .reduce((x, y) => ({ ...x, ...y }), {});
  }
}
