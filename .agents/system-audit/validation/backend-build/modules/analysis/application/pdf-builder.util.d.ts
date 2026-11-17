export interface PdfSection {
    heading: string;
    lines: string[];
}
export declare function buildReportPdf(opts: {
    title: string;
    sections: PdfSection[];
}): Buffer;
