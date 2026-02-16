import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ConfigService } from '../../services/config.service';

@Component({
    selector: 'app-history',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatCardModule,
        MatTableModule,
        MatButtonModule,
        MatIconModule,
        MatChipsModule,
        MatFormFieldModule,
        MatInputModule,
        MatTooltipModule,
        MatPaginatorModule,
        MatProgressBarModule,
        MatSnackBarModule
    ],
    templateUrl: './history.component.html',
    styleUrls: ['./history.component.css']
})
export class HistoryComponent implements OnInit {
    dataSource = new MatTableDataSource<any>([]);
    displayedColumns: string[] = ['timestamp', 'validation_id', 'type', 'status', 'metrics', 'actions'];
    isLoading: boolean = false;
    searchTerm: string = '';
    expandedElement: any | null = null;
    expandedDetail: any = null;

    @ViewChild(MatPaginator) paginator!: MatPaginator;

    constructor(
        private http: HttpClient,
        private snackBar: MatSnackBar,
        private config: ConfigService
    ) { }

    ngOnInit() {
        this.loadHistory();
    }

    loadHistory() {
        this.isLoading = true;
        this.http.get<any[]>(this.config.getApiUrl('/history'))
            .subscribe({
                next: (data) => {
                    this.dataSource.data = data;
                    this.dataSource.paginator = this.paginator;

                    // Custom filter to target only ID and Message Type
                    this.dataSource.filterPredicate = (record: any, filter: string) => {
                        const searchStr = `${record.validation_id} ${record.message_type}`.toLowerCase();
                        return searchStr.includes(filter.toLowerCase());
                    };

                    this.isLoading = false;
                },
                error: (err) => {
                    console.error(err);
                    this.isLoading = false;
                }
            });
    }

    applyFilter() {
        this.dataSource.filter = this.searchTerm.trim().toLowerCase();

        if (this.dataSource.paginator) {
            this.dataSource.paginator.firstPage();
        }
    }

    getStatusClass(status: string) {
        return status ? status.toLowerCase() : 'unknown';
    }

    onViewDetails(element: any) {
        if (this.expandedElement === element) {
            this.expandedElement = null;
            this.expandedDetail = null;
            return;
        }

        this.expandedElement = element;
        this.isLoading = true;
        this.http.get<any>(this.config.getApiUrl(`/history/${element.validation_id}`)).subscribe({
            next: (data) => {
                this.expandedDetail = data;
                this.isLoading = false;
            },
            error: (err) => {
                console.error("Failed to load historical report:", err);
                this.isLoading = false;
                this.snackBar.open('Error loading record details. Backend might be down.', 'Dismiss', { duration: 4000 });
            }
        });
    }

    onDelete(element: any) {
        if (confirm(`Permanentely delete validation record ${element.validation_id}?`)) {
            this.isLoading = true;
            this.http.delete(this.config.getApiUrl(`/history/${element.validation_id}`)).subscribe({
                next: () => {
                    this.loadHistory();
                    if (this.expandedElement === element) {
                        this.expandedElement = null;
                        this.expandedDetail = null;
                    }
                    this.snackBar.open('Record deleted successfully.', 'Close', { duration: 3000 });
                },
                error: (err) => {
                    console.error("Failed to delete record:", err);
                    this.isLoading = false;
                    this.snackBar.open('Failed to delete record. Please check connection.', 'Retry', { duration: 5000 });
                }
            });
        }
    }

    deleteAllHistory() {
        if (confirm('Are you sure you want to PERMANENTLY delete ALL history records? This cannot be undone.')) {
            this.isLoading = true;
            this.http.delete(this.config.getApiUrl('/history')).subscribe({
                next: (res: any) => {
                    this.loadHistory();
                    this.expandedElement = null;
                    this.expandedDetail = null;
                    this.snackBar.open(res.message || 'All records deleted successfully.', 'Close', { duration: 3000 });
                },
                error: (err) => {
                    console.error("Failed to delete all records:", err);
                    this.isLoading = false;
                    this.snackBar.open(`Failed to delete history. Status: ${err.status} ${err.statusText}`, 'Dismiss', { duration: 5000 });
                }
            });
        }
    }

    exportAudit() {
        this.isLoading = true;
        this.http.get(this.config.getApiUrl('/history/export'), { responseType: 'blob' }).subscribe({
            next: (blob) => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `iso20022_audit_trail_${new Date().getTime()}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                this.isLoading = false;
                this.snackBar.open('Audit log exported successfully', 'Close', { duration: 3000 });
            },
            error: (err) => {
                console.error("Export failed:", err);
                this.isLoading = false;
                this.snackBar.open('Export failed. Please try again later.', 'Dismiss', { duration: 5000 });
            }
        });
    }

    isExpansionDetailRow = (i: number, row: Object) => row.hasOwnProperty('detailRow');
}
